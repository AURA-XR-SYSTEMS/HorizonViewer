"""
Manage HORIZON viewer projects.

Usage:
    python scripts/manage_projects.py list                  # List all projects
    python scripts/manage_projects.py active                # Show active project
    python scripts/manage_projects.py switch <project-id>   # Switch active project
    python scripts/manage_projects.py remove <project-id>   # Remove a project
"""

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = PROJECT_ROOT / "public" / "assets" / "projects"
ACTIVE_PATH = PROJECT_ROOT / "public" / "assets" / "active-project.json"


def get_projects():
    projects = []
    for entry in sorted(PROJECTS_DIR.iterdir()):
        config_path = entry / "config.json"
        if entry.is_dir() and config_path.exists():
            with open(config_path) as f:
                cfg = json.load(f)
            views = cfg.get("metadata", {}).get("viewCount", "?")
            transitions = cfg.get("metadata", {}).get("transitionCount", "?")
            projects.append({
                "id": cfg.get("projectId", entry.name),
                "name": cfg.get("projectName", entry.name),
                "views": views,
                "transitions": transitions,
                "path": str(entry),
            })
    return projects


def get_active():
    if ACTIVE_PATH.exists():
        with open(ACTIVE_PATH) as f:
            return json.load(f).get("activeProject")
    return None


def cmd_list():
    projects = get_projects()
    active = get_active()
    if not projects:
        print("No projects found.")
        return

    print(f"{'':2} {'ID':<25} {'Name':<35} {'Views':>5} {'Trans':>5}")
    print("-" * 78)
    for p in projects:
        marker = ">>" if p["id"] == active else "  "
        print(f"{marker} {p['id']:<25} {p['name']:<35} {p['views']:>5} {p['transitions']:>5}")
    print()
    print(f"Active: {active or '(none)'}")
    print(f"URL: / or /embed/demo loads the active project")
    print(f"URL: /embed/<id> loads a specific project")


def cmd_active():
    active = get_active()
    print(active or "(none set)")


def cmd_switch(project_id):
    projects = get_projects()
    ids = [p["id"] for p in projects]
    if project_id not in ids:
        print(f"Project '{project_id}' not found. Available: {', '.join(ids)}")
        sys.exit(1)

    with open(ACTIVE_PATH, "w") as f:
        json.dump({"activeProject": project_id}, f, indent=2)
    print(f"Active project switched to: {project_id}")


def cmd_remove(project_id):
    target = PROJECTS_DIR / project_id
    if not target.exists():
        print(f"Project '{project_id}' not found at {target}")
        sys.exit(1)

    confirm = input(f"Remove project '{project_id}' and all its assets? [y/N] ")
    if confirm.lower() != "y":
        print("Aborted.")
        return

    shutil.rmtree(target)
    print(f"Removed {target}")

    # Update index
    index_path = PROJECTS_DIR / "index.json"
    projects = get_projects()
    with open(index_path, "w") as f:
        json.dump([{"id": p["id"], "name": p["name"]} for p in projects], f, indent=2)

    # Reset active if it was the removed project
    if get_active() == project_id:
        if projects:
            cmd_switch(projects[0]["id"])
        else:
            ACTIVE_PATH.unlink(missing_ok=True)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "list":
        cmd_list()
    elif cmd == "active":
        cmd_active()
    elif cmd == "switch" and len(sys.argv) >= 3:
        cmd_switch(sys.argv[2])
    elif cmd == "remove" and len(sys.argv) >= 3:
        cmd_remove(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
