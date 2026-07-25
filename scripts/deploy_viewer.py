#!/usr/bin/env python3
"""Upload the built viewer to S3 with explicit content types and cache policy.

`aws s3 sync` guesses content types with Python's mimetypes, which is backed by
the platform mime database. That database has no .webp entry before Python 3.13
and often no .mp4 or .woff2 either, so a plain sync uploads most of this bundle
as binary/octet-stream. Browsers refuse to play a video served that way, and the
failure appears at playback rather than at deploy time.

Two rules, applied per file rather than inferred:

  content type   from an explicit table, never from the platform mime database
  cache control  immutable for content-hashed build output and export media,
                 short for hand-edited project configs, none for index.html

Usage:
    python scripts/deploy_viewer.py --bucket aura-horizon-viewer-prod
    python scripts/deploy_viewer.py --bucket ... --distribution-id ... --invalidate
    python scripts/deploy_viewer.py --bucket ... --dry-run
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import boto3
except ImportError:
    print("boto3 is required: pip install boto3", file=sys.stderr)
    raise SystemExit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST = REPO_ROOT / "dist"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
}

IMMUTABLE = "public, max-age=31536000, immutable"
SHORT = "public, max-age=300, must-revalidate"
NO_CACHE = "no-cache"


def cache_control_for(relative_path: str) -> str:
    if relative_path == "index.html":
        # Must never be stale: a cached copy can reference hashed bundles that
        # no longer exist after a deploy.
        return NO_CACHE
    if relative_path.startswith("assets/projects/"):
        # Configs here are hand-edited under stable paths, so they are not
        # immutable the way hashed build output is. The media beside them is
        # large and effectively immutable, so only the JSON gets the short TTL.
        return SHORT if relative_path.endswith(".json") else IMMUTABLE
    if relative_path.startswith("assets/"):
        return IMMUTABLE
    return SHORT


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--distribution-id")
    parser.add_argument("--invalidate", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--profile", default=None)
    args = parser.parse_args()

    if not DIST.is_dir():
        print(f"No build at {DIST}. Run `npm run build` first.", file=sys.stderr)
        return 1

    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    unknown = sorted({p.suffix.lower() for p in files} - set(CONTENT_TYPES))
    if unknown:
        # Guessing here is exactly what this script exists to avoid.
        print(f"Unknown extensions with no content type mapping: {unknown}", file=sys.stderr)
        print("Add them to CONTENT_TYPES before deploying.", file=sys.stderr)
        return 1

    session = boto3.Session(profile_name=args.profile) if args.profile else boto3.Session()
    s3 = session.client("s3")

    counts: dict[str, int] = {}
    for path in files:
        key = path.relative_to(DIST).as_posix()
        content_type = CONTENT_TYPES[path.suffix.lower()]
        cache_control = cache_control_for(key)
        counts[cache_control] = counts.get(cache_control, 0) + 1

        if args.dry_run:
            continue

        s3.upload_file(
            str(path),
            args.bucket,
            key,
            ExtraArgs={"ContentType": content_type, "CacheControl": cache_control},
        )

    verb = "would upload" if args.dry_run else "uploaded"
    print(f"{verb} {len(files)} files to s3://{args.bucket}/")
    for cache_control, count in sorted(counts.items()):
        print(f"  {count:4d}  {cache_control}")

    if args.invalidate and not args.dry_run:
        if not args.distribution_id:
            print("--invalidate requires --distribution-id", file=sys.stderr)
            return 1
        cloudfront = session.client("cloudfront")
        result = cloudfront.create_invalidation(
            DistributionId=args.distribution_id,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/*"]},
                "CallerReference": f"deploy-{len(files)}-{files[0].stat().st_mtime_ns}",
            },
        )
        print(f"invalidation {result['Invalidation']['Id']} {result['Invalidation']['Status']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
