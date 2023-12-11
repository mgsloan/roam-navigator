#!/bin/sh -ex

# Ensure that eslint passes.
./eslint.sh
# Ensure that addons-linter passes
addons-linter src/

rm -f roam-navigator.zip
cd src
zip ../roam-navigator.zip *
cd ../
