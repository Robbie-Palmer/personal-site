#!/usr/bin/env bash
set -euo pipefail

rm -rf outputs/evaluation
mkdir -p outputs/evaluation

pnpm exec tsx src/build-scorecard.ts \
  --cohort outputs/frozen/cohort.json \
  --decision outputs/frozen/decision.json \
  --observations outputs/matched/observations.jsonl \
  --output outputs/evaluation \
  --sql analytics/scorecard.sql
