#!/usr/bin/env python3
"""Publish a bundled project to HorizonServer as a real export job.

The viewer historically shipped curated projects as static files under
public/assets/projects/<slug>/, served straight from the bundle. Shared client
links go through HorizonServer instead, so those projects have to exist as
published exports rather than as a second, parallel delivery path.

This packages a bundled project into the export-artifact layout the server
expects (config.json at the archive root, assets alongside it), rewrites the
absolute /assets/projects/<slug>/... URLs into archive-relative paths, and runs
the create -> upload flow.

Usage:
    python scripts/publish_project.py horizon-metro
    python scripts/publish_project.py maui-busway --export-id my-stable-id
    python scripts/publish_project.py horizon-metro --dry-run

The export id defaults to the project slug so re-running targets the same link
rather than minting a new one. The server rejects a duplicate id with 409; pass
--replace to delete nothing but reuse the id via a fresh upload, or choose a new
--export-id if you want a separate link.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.error
import urllib.request
import uuid
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = REPO_ROOT / "public" / "assets" / "projects"

DEFAULT_API = "https://api.horizon-dev.aura-infra.com"
DEFAULT_WORKSPACE = "aura-demos"


def rewrite_asset_path(url: str, slug: str) -> str:
    """Turn a bundled absolute URL into an archive-relative path.

    /assets/projects/horizon-metro/views/hero.webp -> assets/views/hero.webp

    Absolute http(s) URLs are left alone: the server treats those as external and
    will not try to resolve them inside the archive.
    """
    if url.startswith(("http://", "https://")):
        return url

    prefix = f"/assets/projects/{slug}/"
    if not url.startswith(prefix):
        raise ValueError(
            f"Asset path {url!r} does not live under {prefix!r}; "
            "cannot map it into the export archive."
        )
    return f"assets/{url[len(prefix):]}"


def build_export_config(config: dict, slug: str) -> tuple[dict, dict[str, str]]:
    """Return (rewritten config, {archive path -> source path relative to slug dir}).

    Every asset referenced by the config is collected so the archive contains
    exactly what the config points at. The server's validator rejects a config
    referencing a file that is not present, so mapping these together keeps the
    two from drifting.
    """
    out = json.loads(json.dumps(config))  # deep copy
    assets: dict[str, str] = {}

    def take(url: str) -> str:
        archive_path = rewrite_asset_path(url, slug)
        if not url.startswith(("http://", "https://")):
            assets[archive_path] = url[len(f"/assets/projects/{slug}/"):]
        return archive_path

    for view in out.get("views", []):
        view["imageUrl"] = take(view["imageUrl"])
        if view.get("thumbUrl"):
            view["thumbUrl"] = take(view["thumbUrl"])
        for layer in view.get("alternateLayers") or []:
            layer["imageUrl"] = take(layer["imageUrl"])

    for transition in out.get("transitions", []):
        transition["videoUrl"] = take(transition["videoUrl"])

    return out, assets


def build_zip(slug: str, config: dict, assets: dict[str, str]) -> bytes:
    project_dir = PROJECTS_DIR / slug
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("config.json", json.dumps(config, indent=2))
        for archive_path, source_rel in sorted(assets.items()):
            source = project_dir / source_rel
            if not source.is_file():
                raise FileNotFoundError(
                    f"Config references {source_rel!r} but {source} does not exist."
                )
            archive.write(source, archive_path)

    return buffer.getvalue()


def post_json(url: str, payload: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def post_multipart_zip(url: str, zip_bytes: bytes, filename: str) -> dict:
    boundary = f"----horizon{uuid.uuid4().hex}"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
            b"Content-Type: application/zip\r\n\r\n",
            zip_bytes,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
    )
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    # Large archives over a cold ALB connection need generous headroom.
    with urllib.request.urlopen(request, timeout=900) as response:
        return json.loads(response.read().decode("utf-8"))


def describe_http_error(error: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(error.read().decode("utf-8"))
        detail = payload.get("detail", payload)
    except Exception:
        detail = error.reason
    return f"HTTP {error.code}: {detail}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="Project folder under public/assets/projects/")
    parser.add_argument("--api", default=DEFAULT_API, help=f"API base (default {DEFAULT_API})")
    parser.add_argument("--workspace-id", default=DEFAULT_WORKSPACE)
    parser.add_argument("--export-id", help="Defaults to the project slug")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build and validate the archive without uploading",
    )
    args = parser.parse_args()

    project_dir = PROJECTS_DIR / args.slug
    config_path = project_dir / "config.json"
    if not config_path.is_file():
        print(f"No config.json at {config_path}", file=sys.stderr)
        return 1

    config = json.loads(config_path.read_text(encoding="utf-8"))
    export_config, assets = build_export_config(config, args.slug)
    zip_bytes = build_zip(args.slug, export_config, assets)

    print(f"{args.slug}: {len(export_config.get('views', []))} views, "
          f"{len(export_config.get('transitions', []))} transitions, "
          f"{len(assets)} assets, {len(zip_bytes) / 1_048_576:.1f} MB")

    if args.dry_run:
        print("Dry run: archive built and all referenced assets exist. Not uploaded.")
        return 0

    api = args.api.rstrip("/")
    export_id = args.export_id or args.slug

    try:
        created = post_json(
            f"{api}/api/exports/{args.workspace_id}/new", {"exportId": export_id}
        )
        print(f"created export job {created['exportId']} ({created['status']})")
    except urllib.error.HTTPError as error:
        if error.code == 409:
            print(f"export job {export_id} already exists; uploading into it")
        else:
            print(f"create failed: {describe_http_error(error)}", file=sys.stderr)
            return 1

    try:
        result = post_multipart_zip(
            f"{api}/api/exports/{args.workspace_id}/{export_id}/upload",
            zip_bytes,
            f"{args.slug}.zip",
        )
    except urllib.error.HTTPError as error:
        print(f"upload failed: {describe_http_error(error)}", file=sys.stderr)
        return 1

    print(f"status:    {result['status']}")
    if result.get("warningMessage"):
        print(f"warning:   {result['warningMessage']}")
    if result.get("errorMessage"):
        print(f"error:     {result['errorMessage']}")
        return 1
    print(f"viewerUrl: {result.get('viewerUrl')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
