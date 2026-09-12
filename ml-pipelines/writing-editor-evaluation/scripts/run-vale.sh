#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/run-vale.ts \
  --cohort outputs/frozen/cohort.json \
  --corpus data/corpus \
  --params params.yaml \
  --config ../../.vale.ini \
  --styles ../../.vale/styles/Unslop \
  --output outputs/producers/vale.json
