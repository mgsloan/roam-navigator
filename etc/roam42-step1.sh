#!/bin/bash -ex

# This script rebases the roam42 branch atop master

if [ -n "$(git status --porcelain)" ]; then
    echo "roam-navigator repository not clean, not doing anything."
    exit 1
fi

git checkout roam42
git rebase master
