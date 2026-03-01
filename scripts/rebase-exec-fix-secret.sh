#!/bin/sh
# Run after each commit during rebase: remove secret from .env.example and amend if changed
sh /c/Users/lenovo/projects/SILS/scripts/tree-filter-remove-secret.sh
git add apps/web/.env.example 2>/dev/null || true
git diff --cached --quiet || git commit --amend --no-edit
