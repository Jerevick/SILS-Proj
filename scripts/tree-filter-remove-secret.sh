#!/bin/sh
# Tree filter: replace Anthropic secret with placeholder in apps/web/.env.example
# Uses a pattern so no real key is ever stored in this file.
if [ -f apps/web/.env.example ]; then
  # Use a temp file to avoid sed -i portability issues
  sed 's|sk-ant-api03-[^"]*|sk-ant-xxx|g' apps/web/.env.example > apps/web/.env.example.tmp
  mv apps/web/.env.example.tmp apps/web/.env.example
fi
