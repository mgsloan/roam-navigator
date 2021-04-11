#!/bin/bash -ex

# This script pushes the roam42 branch, creates a new branch + commit
# in the roam42 project with the changes, and pulls changes from
# upstream.  This may require manual merging.

if [ -n "$(git status --porcelain)" ]; then
    echo "Repository not clean, not doing anything."
    exit 1
fi

if [ "$#" -ne 1 ]; then
    echo "Expected one argument to indicate version #"
    exit 1
fi

git push origin --force-with-lease

cd ~/oss/roam42

if [ -n "$(git status --porcelain)" ]; then
    echo "Roam42 repository not clean, not doing anything."
    exit 1
fi

git checkout master

# Apply and commit changes *before* pulling, in order to be notified
# of conflicts.
cp ~/proj/roam-navigator/src/roam-navigator.js ~/oss/roam42/ext/roam-navigator.js

git checkout -b "roam-navigator-version-$1"

MSG="Update roam-navigator to version $1"
git commit -a -m "$MSG"

git pull --rebase origin master
