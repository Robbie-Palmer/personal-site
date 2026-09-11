#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/match-edits.ts \
  --cohort outputs/frozen/cohort.json \
  --corpus data/corpus \
  --findings outputs/producers/vale.json \
  --params params.yaml \
  --output outputs/matched/vale.json
