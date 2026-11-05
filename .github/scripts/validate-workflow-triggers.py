#!/usr/bin/env python3
"""GitHub Actions trigger semantics for DAL and Sonar (fnmatch + pull_request types)."""
from __future__ import annotations

import fnmatch
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ("dal.yml", "sonar.yml")
FEATURE_BRANCH = "fix/ci-duplicate-workflow-triggers"


def load_on(path: Path) -> dict:
    data = yaml.safe_load(path.read_text())
    on = data.get("on")
    if on is None:
        on = data.get(True)
    if on is None:
        raise ValueError(f"{path}: missing 'on'")
    return on


def branch_push_matches(on: dict, ref: str) -> bool:
    push = on.get("push")
    if push is None:
        return False
    if push is True:
        return True
    branches = push.get("branches")
    if branches is None:
        return True
    if isinstance(branches, str):
        branches = [branches]
    return any(fnmatch.fnmatch(ref, pat) for pat in branches)


def pull_request_matches(on: dict, action: str) -> bool:
    pr = on.get("pull_request")
    if pr is None:
        return False
    if pr is True:
        return True
    types = pr.get("types")
    if types is None:
        return True
    return action in types


def main() -> int:
    failures: list[str] = []

    for name in WORKFLOWS:
        on = load_on(REPO_ROOT / ".github/workflows" / name)

        cases = [
            ("push_feature_branch", branch_push_matches(on, FEATURE_BRANCH), False),
            ("push_main", branch_push_matches(on, "main"), True),
            ("pull_request_synchronize", pull_request_matches(on, "synchronize"), True),
            ("pull_request_closed", pull_request_matches(on, "closed"), False),
        ]
        for case_name, actual, expected in cases:
            if actual != expected:
                failures.append(f"{name}/{case_name}: expected {expected}, got {actual}")

        push_branches = (on.get("push") or {}).get("branches")
        if push_branches == ["**"] or push_branches == "**":
            failures.append(f"{name}: push still matches all branches")

    if failures:
        print("FAILURES:", *failures, sep="\n", file=sys.stderr)
        return 1

    print("All semantic trigger checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
