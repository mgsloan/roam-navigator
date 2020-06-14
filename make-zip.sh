#!/bin/sh -ex

# Ensure that eslint passes.
./eslint.sh

rm -f roam-navigator.zip
cd src
zip ../todoist-shortcuts.zip inject.js manifest.json roam-navigator.js
cd ../
