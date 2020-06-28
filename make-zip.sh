#!/bin/sh -ex

# Ensure that eslint passes.
./eslint.sh

rm -f roam-navigator.zip
cd src
zip ../roam-navigator.zip *
cd ../
