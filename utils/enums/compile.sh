#!/bin/bash

# MACOS SHELL SCRIPT - THIS ONLY WORKS ON UNIX BASED SYSTEMS
# This shell script compiles all TypeScript files in the current directory.

for tsfile in ./utils/enums/*.ts; do
  tsc $tsfile
done