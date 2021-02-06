#!/bin/bash -ex

# This script pushes the new branch and opens a PR. Since roam42
# changes may have been made to roam-navigator, this also handles
# merging those into the roam42 branch.

cd ~/oss/roam42

if [ -n "$(git status --porcelain)" ]; then
    echo "roam42 repository not clean, not doing anything."
    exit 1
fi

if [ "$#" -ne 1 ]; then
    echo "Expected one argument to indicate version #"
    exit 1
fi

git push mgsloan

# Use hub cli to create PR and open in browser
MSG="Update roam-navigator to version $1"
hub pull-request --browse -m "$MSG"

cd ~/proj/roam-navigator

# Now we need to apply the changes back to the roam42 branch in
# roam-navigator.

if [ "$(git rev-parse --abbrev-ref HEAD)" -ne "roam42" ]; then
    echo "Expected roam-navigator to be on roam42 branch."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "roam-navigator repository not clean."
    exit 1
fi

cp ~/oss/roam42/ext/roam-navigator.js ~/proj/roam-navigator/src/roam-navigator.js

git commit -a --amend --no-edit
git push origin --force-with-lease
