#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/extract-corpus.ts --output data/corpus --params params.yaml
