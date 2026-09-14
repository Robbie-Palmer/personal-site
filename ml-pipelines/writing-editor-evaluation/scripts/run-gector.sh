#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/run-gector.ts \
  --cohort outputs/frozen/cohort.json \
  --corpus data/corpus \
  --model data/models/gector-2024 \
  --manifest model-manifest.json \
  --params params.yaml \
  --output outputs/producers/gector
