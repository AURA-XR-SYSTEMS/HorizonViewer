"""
Encode HORIZON VideoCaptures -> H.264 MP4 videos + static view images + config JSON.

Usage:
    python scripts/encode_transitions.py --use-mp4              # Copy existing MP4s (fast)
    python scripts/encode_transitions.py --resolution 1920x1080 # Re-encode from frames

Output structure:
    public/assets/horizon/
        views/          Static JPG per view (first frame of any outgoing transition)
        transitions/    MP4 per transition folder
        config.json     ProjectConfig for the viewer
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Paths
SOURCE_DIR = Path(r"C:\Perforce\AURA_DEV_WORKSPACE\AURA_MAUI\Saved\VideoCaptures")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "public" / "assets" / "horizon"

def slugify(name: str) -> str:
    """Convert view name to URL-safe slug."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return s

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

def copy_mp4_transition(t: dict, output_dir: Path) -> dict:
    """Copy an existing MP4 transition video."""
    from_slug = slugify(t["from_name"])
    to_slug = slugify(t["to_name"])
    filename = f"{from_slug}_to_{to_slug}.mp4"
    out_path = output_dir / "transitions" / filename

    if out_path.exists():
        size_mb = out_path.stat().st_size / (1024 * 1024)
        return {"file": filename, "size_mb": size_mb, "status": "exists"}

    try:
        shutil.copy2(t["mp4_path"], out_path)
        size_mb = out_path.stat().st_size / (1024 * 1024)
        return {"file": filename, "size_mb": size_mb, "status": "ok"}
    except Exception as e:
        return {"file": filename, "status": "error", "error": str(e)}

def encode_transition(t: dict, resolution: str, crf: int, fps: int, output_dir: Path) -> dict:
    """Encode a single transition folder → MP4."""
    from_slug = slugify(t["from_name"])
    to_slug = slugify(t["to_name"])
    filename = f"{from_slug}_to_{to_slug}.mp4"
    out_path = output_dir / "transitions" / filename

    if out_path.exists():
        size_mb = out_path.stat().st_size / (1024 * 1024)
        return {"file": filename, "size_mb": size_mb, "status": "exists"}

    frames_dir = t["frames_dir"]
    input_pattern = os.path.join(frames_dir, "frame_%06d.png")

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", input_pattern,
        "-vf", f"scale={resolution.replace('x', ':')}",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(out_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return {"file": filename, "status": "error", "error": result.stderr[-500:]}

    size_mb = out_path.stat().st_size / (1024 * 1024)
    return {"file": filename, "size_mb": size_mb, "status": "ok"}

def extract_view_image_from_mp4(view_name: str, transitions: list, output_dir: Path) -> str | None:
    """Extract last frame from an incoming transition as the static view image (Cesium fully loaded)."""
    slug = slugify(view_name)
    out_path = output_dir / "views" / f"{slug}.jpg"

    if out_path.exists():
        return f"/assets/horizon/views/{slug}.jpg"

    # Use last frame of a transition TO this view (arrival = fully loaded)
    for t in transitions:
        if t["to_name"] == view_name and "mp4_path" in t:
            # Prefer last PNG frame for max quality
            folder = Path(t["mp4_path"]).parent
            frames_dir = folder / "frames"
            if frames_dir.is_dir():
                frames = sorted(frames_dir.glob("frame_*.png"))
                if frames:
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", str(frames[-1]),
                        "-q:v", "2",
                        str(out_path),
                    ]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                    if result.returncode == 0:
                        return f"/assets/horizon/views/{slug}.jpg"

            # Fallback: last frame from MP4
            cmd = [
                "ffmpeg", "-y",
                "-sseof", "-0.1",
                "-i", t["mp4_path"],
                "-vframes", "1",
                "-q:v", "2",
                str(out_path),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                return f"/assets/horizon/views/{slug}.jpg"
    return None

def extract_view_image_from_frames(view_name: str, transitions: list, resolution: str, output_dir: Path) -> str | None:
    """Extract first frame from PNG sequence as the static view image."""
    slug = slugify(view_name)
    out_path = output_dir / "views" / f"{slug}.jpg"

    if out_path.exists():
        return f"/assets/horizon/views/{slug}.jpg"

    for t in transitions:
        if t["from_name"] == view_name:
            frames_dir = t["frames_dir"]
            first_frame = os.path.join(frames_dir, "frame_000000.png")
            if os.path.exists(first_frame):
                cmd = [
                    "ffmpeg", "-y",
                    "-i", first_frame,
                    "-vf", f"scale={resolution.replace('x', ':')}",
                    "-q:v", "2",
                    str(out_path),
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    return f"/assets/horizon/views/{slug}.jpg"
    return None

def generate_config(views: list, transitions: list, view_images: dict) -> dict:
    """Generate ProjectConfig JSON."""
    view_nodes = []
    view_id_map = {}
    for i, name in enumerate(views, start=1):
        view_id_map[name] = i
        view_nodes.append({
            "id": i,
            "name": name,
            "imageUrl": view_images.get(name, ""),
        })

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
            "videoUrl": f"/assets/horizon/transitions/{from_slug}_to_{to_slug}.mp4",
            "key": key,
        })

    return {
        "projectId": "horizon-metro",
        "projectName": "HORIZON - Metro Digital Twin",
        "views": view_nodes,
        "transitions": transition_list,
        "locations": [],
        "metadata": {
            "description": f"LA Metro HORIZON project - {len(views)} views with full transition coverage",
            "viewCount": len(views),
            "transitionCount": len(transitions),
        },
    }

def main():
    parser = argparse.ArgumentParser(description="Encode HORIZON transitions")
    parser.add_argument("--resolution", default="1920x1080", help="Output resolution (default: 1920x1080)")
    parser.add_argument("--crf", type=int, default=26, help="H.264 CRF quality (default: 26, lower=better)")
    parser.add_argument("--fps", type=int, default=30, help="Frame rate (default: 30)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel encoding threads (default: 4)")
    parser.add_argument("--use-mp4", action="store_true", help="Copy existing MP4s instead of re-encoding from frames")
    args = parser.parse_args()

    print(f"=== HORIZON Transition Encoder ===")
    print(f"Source: {SOURCE_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    if args.use_mp4:
        print(f"Mode: Copy existing MP4s (native resolution)")
    else:
        print(f"Mode: Encode from frames")
        print(f"Resolution: {args.resolution}, CRF: {args.crf}, FPS: {args.fps}")
    print()

    # Create output directories
    (OUTPUT_DIR / "views").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "transitions").mkdir(parents=True, exist_ok=True)

    # Discover
    print("Discovering views and transitions...")
    views, transitions = discover_views_and_transitions(SOURCE_DIR, use_mp4=args.use_mp4)
    print(f"  Found {len(views)} views, {len(transitions)} transitions")
    print(f"  Views: {', '.join(views)}")
    print()

    # Extract static view images
    print("Extracting static view images...")
    view_images = {}
    for name in views:
        if args.use_mp4:
            url = extract_view_image_from_mp4(name, transitions, OUTPUT_DIR)
        else:
            url = extract_view_image_from_frames(name, transitions, args.resolution, OUTPUT_DIR)
        if url:
            view_images[name] = url
            print(f"  [OK] {name}")
        else:
            print(f"  [FAIL] {name} (no source found)")
    print()

    # Process transitions
    if args.use_mp4:
        print(f"Copying {len(transitions)} MP4 transitions...")
        results = []
        for i, t in enumerate(transitions, 1):
            result = copy_mp4_transition(t, OUTPUT_DIR)
            results.append(result)
            status = result["status"]
            size = f"{result.get('size_mb', 0):.1f}MB" if "size_mb" in result else ""
            prefix = "[OK]" if status in ("ok", "exists") else "[FAIL]"
            tag = " (cached)" if status == "exists" else ""
            print(f"  [{i}/{len(transitions)}] {prefix} {result['file']} {size}{tag}")
            if status == "error":
                print(f"      Error: {result.get('error', '')[:200]}")
    else:
        print(f"Encoding {len(transitions)} transitions ({args.workers} workers)...")
        results = []
        completed = 0

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
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
    total_size = sum(r.get("size_mb", 0) for r in ok_results)
    print()
    print(f"=== Results ===")
    print(f"  Processed: {len(ok_results)}/{len(transitions)}")
    print(f"  Total size: {total_size:.1f} MB")
    print(f"  Avg per video: {total_size/max(len(ok_results),1):.1f} MB")

    # Generate config
    config = generate_config(views, transitions, view_images)
    config_path = OUTPUT_DIR / "config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"  Config: {config_path}")
    print()
    print("Done!")

if __name__ == "__main__":
    main()
