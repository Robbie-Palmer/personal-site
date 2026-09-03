#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/freeze-cohort.ts --dataset data/corpus/manifest.json --output outputs/frozen --params params.yaml
