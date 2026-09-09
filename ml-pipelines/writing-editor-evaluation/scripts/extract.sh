#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/extract-dataset.ts \
  --manifest corpus-manifest.json \
  --repository ../.. \
  --output data/corpus
