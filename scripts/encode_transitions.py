"""
Encode HORIZON VideoCaptures -> H.264 MP4 videos + static view images + config JSON.

Usage:
    python scripts/encode_transitions.py --use-mp4                          # Default project
    python scripts/encode_transitions.py --use-mp4 --project maui-busway   # Named project
    python scripts/encode_transitions.py --use-mp4 --source "D:\\renders"   # Custom source

Output structure:
    public/assets/projects/{project-slug}/
        views/          Full-res WebP still + 288px WebP thumbnail per view
        transitions/    Web-optimized MP4 per transition folder (faststart verified)
        config.json     ProjectConfig for the viewer
"""

import argparse
import json
import os
import re
import struct
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Paths
DEFAULT_SOURCE_DIR = Path(r"C:\Perforce\AURA_DEV_WORKSPACE\AURA_MAUI\Saved\VideoCaptures")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = PROJECT_ROOT / "public" / "assets" / "projects"

# Still image encoding
WEBP_QUALITY = 82
THUMB_WIDTH = 288
THUMB_QUALITY = 80
ALPHA_PIX_FMTS = ("rgba", "argb", "bgra", "ya", "pal8")

def slugify(name: str) -> str:
    """Convert view name to URL-safe slug."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s

def to_webp_url(url: str) -> str:
    """Point a JPG/PNG asset URL at its WebP twin."""
    return re.sub(r'\.(jpe?g|png)$', '.webp', url, flags=re.IGNORECASE)

def scale_filter(resolution: str) -> str:
    """Build an ffmpeg scale filter from '1440' (width, aspect preserved) or '1920x1080'."""
    r = resolution.strip().lower()
    if "x" in r:
        return f"scale={r.replace('x', ':')}"
    return f"scale={r}:-2"

def has_faststart(path) -> bool:
    """Return True if the MP4's moov atom precedes its mdat atom (progressive playback)."""
    order = []
    try:
        with open(path, 'rb') as f:
            while True:
                hdr = f.read(8)
                if len(hdr) < 8:
                    break
                size = struct.unpack('>I', hdr[:4])[0]
                order.append(hdr[4:8].decode('latin1', 'replace'))
                if size == 1:
                    size = struct.unpack('>Q', f.read(8))[0]
                    f.seek(size - 16, 1)
                elif size == 0:
                    break
                else:
                    f.seek(size - 8, 1)
    except OSError:
        return False
    return 'moov' in order and 'mdat' in order and order.index('moov') < order.index('mdat')

def source_has_alpha(source: str) -> bool:
    """Probe a source image/video for an alpha-carrying pixel format."""
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=pix_fmt",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(source),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except subprocess.SubprocessError:
        return False
    if result.returncode != 0:
        return False
    pix_fmt = result.stdout.strip().lower()
    return any(fmt in pix_fmt for fmt in ALPHA_PIX_FMTS)

def parse_folder_name(folder: str):
    """Extract (from_name, to_name) from folder like 'Air Filtration Index_to_Habitat'."""
    match = re.match(r'^(.+?)_to_(.+)$', folder)
    if not match:
        return None, None
    return match.group(1).strip(), match.group(2).strip()

def discover_views_and_transitions(source_dir: Path, use_mp4: bool = False):
    """Scan folder names to build view list and transition list."""
    views = set()
    transitions = []

    for entry in sorted(source_dir.iterdir()):
        if not entry.is_dir():
            continue
        from_name, to_name = parse_folder_name(entry.name)
        if not from_name or not to_name:
            print(f"  SKIP: {entry.name} (doesn't match pattern)")
            continue
        views.add(from_name)
        views.add(to_name)

        if use_mp4:
            # Look for MP4 file in the folder
            mp4_files = list(entry.glob("*.mp4"))
            if not mp4_files:
                print(f"  SKIP: {entry.name} (no MP4 found)")
                continue
            transitions.append({
                "folder": entry.name,
                "from_name": from_name,
                "to_name": to_name,
                "mp4_path": str(mp4_files[0]),
            })
        else:
            # Find frames directory
            frames_dir = entry / "frames"
            if not frames_dir.is_dir():
                frames_dir = entry

            png_count = len(list(frames_dir.glob("frame_*.png")))
            if png_count == 0:
                print(f"  SKIP: {entry.name} (no frames found)")
                continue

            transitions.append({
                "folder": entry.name,
                "from_name": from_name,
                "to_name": to_name,
                "frames_dir": str(frames_dir),
                "frame_count": png_count,
            })

    views = sorted(views)
    return views, transitions

def encode_mp4_transition(t: dict, resolution: str, crf: int, output_dir: Path) -> dict:
    """Re-encode an existing MP4 transition for web delivery (scaled, CRF, faststart)."""
    from_slug = slugify(t["from_name"])
    to_slug = slugify(t["to_name"])
    filename = f"{from_slug}_to_{to_slug}.mp4"
    out_path = output_dir / "transitions" / filename

    if out_path.exists():
        size_mb = out_path.stat().st_size / (1024 * 1024)
        if not has_faststart(out_path):
            return {
                "file": filename,
                "size_mb": size_mb,
                "status": "error",
                "error": "existing file has moov after mdat (delete it to re-encode with +faststart)",
            }
        return {"file": filename, "size_mb": size_mb, "status": "exists"}

    cmd = [
        "ffmpeg", "-y",
        "-i", t["mp4_path"],
        "-vf", scale_filter(resolution),
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(out_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        return {"file": filename, "status": "error", "error": result.stderr[-500:]}

    size_mb = out_path.stat().st_size / (1024 * 1024)
    if not has_faststart(out_path):
        return {
            "file": filename,
            "size_mb": size_mb,
            "status": "error",
            "error": "faststart verification failed (moov atom is not before mdat)",
        }
    return {"file": filename, "size_mb": size_mb, "status": "ok"}

def encode_transition(t: dict, resolution: str, crf: int, fps: int, output_dir: Path) -> dict:
    """Encode a single transition folder → MP4."""
    from_slug = slugify(t["from_name"])
    to_slug = slugify(t["to_name"])
    filename = f"{from_slug}_to_{to_slug}.mp4"
    out_path = output_dir / "transitions" / filename

    if out_path.exists():
        size_mb = out_path.stat().st_size / (1024 * 1024)
        if not has_faststart(out_path):
            return {
                "file": filename,
                "size_mb": size_mb,
                "status": "error",
                "error": "existing file has moov after mdat (delete it to re-encode with +faststart)",
            }
        return {"file": filename, "size_mb": size_mb, "status": "exists"}

    frames_dir = t["frames_dir"]
    input_pattern = os.path.join(frames_dir, "frame_%06d.png")

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", input_pattern,
        "-vf", scale_filter(resolution),
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(out_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        return {"file": filename, "status": "error", "error": result.stderr[-500:]}

    size_mb = out_path.stat().st_size / (1024 * 1024)
    if not has_faststart(out_path):
        return {
            "file": filename,
            "size_mb": size_mb,
            "status": "error",
            "error": "faststart verification failed (moov atom is not before mdat)",
        }
    return {"file": filename, "size_mb": size_mb, "status": "ok"}

def encode_webp(input_args: list, out_path: Path, quality: int, width, alpha: bool) -> bool:
    """Encode one frame from an ffmpeg input to WebP, optionally scaled to a target width."""
    cmd = ["ffmpeg", "-y"] + input_args
    if width:
        cmd += ["-vf", f"scale={width}:-2"]
    cmd += ["-c:v", "libwebp", "-quality", str(quality)]
    if alpha:
        cmd += ["-pix_fmt", "yuva420p"]
    cmd += ["-frames:v", "1", str(out_path)]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.returncode == 0

def write_view_images(input_args: list, source: str, slug: str, output_dir: Path, project_slug: str):
    """Write the full-res WebP still + carousel thumbnail for one view."""
    full_path = output_dir / "views" / f"{slug}.webp"
    thumb_path = output_dir / "views" / f"{slug}-thumb.webp"
    urls = {
        "imageUrl": f"/assets/projects/{project_slug}/views/{slug}.webp",
        "thumbUrl": f"/assets/projects/{project_slug}/views/{slug}-thumb.webp",
    }

    if full_path.exists() and thumb_path.exists():
        return urls

    alpha = source_has_alpha(source)
    if not full_path.exists():
        if not encode_webp(input_args, full_path, WEBP_QUALITY, None, alpha):
            return None
    if not thumb_path.exists():
        if not encode_webp(input_args, thumb_path, THUMB_QUALITY, THUMB_WIDTH, alpha):
            return None
    return urls

def extract_view_image_from_mp4(view_name: str, transitions: list, output_dir: Path, project_slug: str):
    """Extract last frame from an incoming transition as the static view image (Cesium fully loaded)."""
    slug = slugify(view_name)

    # Use last frame of a transition TO this view (arrival = fully loaded)
    for t in transitions:
        if t["to_name"] == view_name and "mp4_path" in t:
            # Prefer last PNG frame for max quality
            folder = Path(t["mp4_path"]).parent
            frames_dir = folder / "frames"
            if frames_dir.is_dir():
                frames = sorted(frames_dir.glob("frame_*.png"))
                if frames:
                    urls = write_view_images(
                        ["-i", str(frames[-1])], str(frames[-1]), slug, output_dir, project_slug
                    )
                    if urls:
                        return urls

            # Fallback: last frame from MP4
            urls = write_view_images(
                ["-sseof", "-0.1", "-i", t["mp4_path"]], t["mp4_path"], slug, output_dir, project_slug
            )
            if urls:
                return urls
    return None

def extract_view_image_from_frames(view_name: str, transitions: list, output_dir: Path, project_slug: str):
    """Extract first frame from PNG sequence as the static view image."""
    slug = slugify(view_name)

    for t in transitions:
        if t["from_name"] == view_name:
            frames_dir = t["frames_dir"]
            first_frame = os.path.join(frames_dir, "frame_000000.png")
            if os.path.exists(first_frame):
                urls = write_view_images(
                    ["-i", first_frame], first_frame, slug, output_dir, project_slug
                )
                if urls:
                    return urls
    return None

def generate_config(views: list, transitions: list, view_images: dict, project_slug: str,
                    project_name: str, existing: dict | None = None) -> dict:
    """Generate ProjectConfig JSON (see src/types.ts)."""
    existing = existing or {}
    existing_views = {v.get("name"): v for v in existing.get("views", [])}

    view_nodes = []
    view_id_map = {}
    for i, name in enumerate(views, start=1):
        view_id_map[name] = i
        images = view_images.get(name, {})
        node = {
            "id": i,
            "name": name,
            "imageUrl": images.get("imageUrl", ""),
            "thumbUrl": images.get("thumbUrl", ""),
        }
        alternates = [
            {"name": alt.get("name", ""), "imageUrl": to_webp_url(alt.get("imageUrl", ""))}
            for alt in existing_views.get(name, {}).get("alternateLayers", [])
        ]
        if alternates:
            node["alternateLayers"] = alternates
        view_nodes.append(node)

    transition_list = []
    for t in transitions:
        from_id = view_id_map[t["from_name"]]
        to_id = view_id_map[t["to_name"]]
        from_slug = slugify(t["from_name"])
        to_slug = slugify(t["to_name"])
        key = f"{from_id}-{to_id}"
        transition_list.append({
            "from": from_id,
            "to": to_id,
            "videoUrl": f"/assets/projects/{project_slug}/transitions/{from_slug}_to_{to_slug}.mp4",
            "key": key,
        })

    return {
        "projectId": project_slug,
        "projectName": project_name,
        "views": view_nodes,
        "transitions": transition_list,
        "locations": existing.get("locations", []),
        "metadata": {
            "description": f"{project_name} - {len(views)} views with full transition coverage",
            "viewCount": len(views),
            "transitionCount": len(transitions),
        },
    }

def update_project_index(projects_dir: Path):
    """Scan projects dir and write index.json + active-project.json."""
    projects = []
    for entry in sorted(projects_dir.iterdir()):
        config_path = entry / "config.json"
        if entry.is_dir() and config_path.exists():
            with open(config_path) as f:
                cfg = json.load(f)
            projects.append({
                "id": cfg.get("projectId", entry.name),
                "name": cfg.get("projectName", entry.name),
            })

    # Write index
    index_path = projects_dir / "index.json"
    with open(index_path, "w") as f:
        json.dump(projects, f, indent=2)
    print(f"  Updated {index_path} ({len(projects)} projects)")

    # Write active-project.json if it doesn't exist (default to first)
    active_path = projects_dir.parent / "active-project.json"
    if not active_path.exists() and projects:
        with open(active_path, "w") as f:
            json.dump({"activeProject": projects[0]["id"]}, f, indent=2)
        print(f"  Created {active_path} -> {projects[0]['id']}")


def main():
    parser = argparse.ArgumentParser(description="Encode HORIZON transitions")
    parser.add_argument("--project", required=True, help="Project slug (e.g. maui-busway)")
    parser.add_argument("--name", default=None, help="Project display name (defaults to slug)")
    parser.add_argument("--source", default=None, help="Source directory (default: Perforce VideoCaptures)")
    parser.add_argument("--resolution", default="1440", help="Video target width, or WxH (default: 1440, aspect preserved)")
    parser.add_argument("--crf", type=int, default=26, help="H.264 CRF quality (default: 26, lower=better)")
    parser.add_argument("--fps", type=int, default=30, help="Frame rate (default: 30)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel encoding threads (default: 4)")
    parser.add_argument("--use-mp4", action="store_true", help="Re-encode existing MP4s instead of encoding from frames")
    parser.add_argument("--set-active", action="store_true", help="Set this project as the active (demo) project")
    args = parser.parse_args()

    source_dir = Path(args.source) if args.source else DEFAULT_SOURCE_DIR
    project_slug = args.project
    project_name = args.name or project_slug.replace("-", " ").title()
    OUTPUT_DIR = PROJECTS_DIR / project_slug

    print(f"=== HORIZON Transition Encoder ===")
    print(f"Project: {project_slug} ({project_name})")
    print(f"Source:  {source_dir}")
    print(f"Output:  {OUTPUT_DIR}")
    if args.use_mp4:
        print(f"Mode: Re-encode existing MP4s")
        print(f"Resolution: {args.resolution}, CRF: {args.crf}")
    else:
        print(f"Mode: Encode from frames")
        print(f"Resolution: {args.resolution}, CRF: {args.crf}, FPS: {args.fps}")
    print(f"Stills: WebP q{WEBP_QUALITY} + {THUMB_WIDTH}px thumbs q{THUMB_QUALITY}")
    print()

    # Create output directories
    (OUTPUT_DIR / "views").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "transitions").mkdir(parents=True, exist_ok=True)

    # Discover
    print("Discovering views and transitions...")
    views, transitions = discover_views_and_transitions(source_dir, use_mp4=args.use_mp4)
    print(f"  Found {len(views)} views, {len(transitions)} transitions")
    print(f"  Views: {', '.join(views)}")
    print()

    # Extract static view images
    print("Extracting static view images...")
    view_images = {}
    for name in views:
        if args.use_mp4:
            urls = extract_view_image_from_mp4(name, transitions, OUTPUT_DIR, project_slug)
        else:
            urls = extract_view_image_from_frames(name, transitions, OUTPUT_DIR, project_slug)
        if urls:
            view_images[name] = urls
            print(f"  [OK] {name}")
        else:
            print(f"  [FAIL] {name} (no source found)")
    print()

    # Process transitions
    verb = "Re-encoding" if args.use_mp4 else "Encoding"
    print(f"{verb} {len(transitions)} transitions ({args.workers} workers)...")
    results = []
    completed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        if args.use_mp4:
            futures = {
                pool.submit(encode_mp4_transition, t, args.resolution, args.crf, OUTPUT_DIR): t
                for t in transitions
            }
        else:
            futures = {
                pool.submit(encode_transition, t, args.resolution, args.crf, args.fps, OUTPUT_DIR): t
                for t in transitions
            }
        for future in as_completed(futures):
            t = futures[future]
            completed += 1
            result = future.result()
            results.append(result)
            status = result["status"]
            size = f"{result.get('size_mb', 0):.1f}MB" if "size_mb" in result else ""
            prefix = "[OK]" if status in ("ok", "exists") else "[FAIL]"
            tag = " (cached)" if status == "exists" else ""
            print(f"  [{completed}/{len(transitions)}] {prefix} {result['file']} {size}{tag}")
            if status == "error":
                print(f"      Error: {result.get('error', '')[:200]}")

    # Stats
    ok_results = [r for r in results if r["status"] in ("ok", "exists")]
    failed = [r for r in results if r["status"] == "error"]
    total_size = sum(r.get("size_mb", 0) for r in ok_results)
    print()
    print(f"=== Results ===")
    print(f"  Processed: {len(ok_results)}/{len(transitions)}")
    print(f"  Total size: {total_size:.1f} MB")
    print(f"  Avg per video: {total_size/max(len(ok_results),1):.1f} MB")
    if failed:
        print(f"  Failed: {len(failed)}")
        for r in failed:
            print(f"    - {r['file']}: {r.get('error', '')[:200]}")

    # Generate config
    config_path = OUTPUT_DIR / "config.json"
    existing_config = None
    if config_path.exists():
        with open(config_path) as f:
            existing_config = json.load(f)
    config = generate_config(views, transitions, view_images, project_slug, project_name, existing_config)
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"  Config: {config_path}")

    # Update project index
    print()
    print("Updating project index...")
    update_project_index(PROJECTS_DIR)

    # Set as active project if requested
    if args.set_active:
        active_path = PROJECTS_DIR.parent / "active-project.json"
        with open(active_path, "w") as f:
            json.dump({"activeProject": project_slug}, f, indent=2)
        print(f"  Active project set to: {project_slug}")

    print()
    print("Done!")

if __name__ == "__main__":
    main()
