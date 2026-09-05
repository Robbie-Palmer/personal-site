#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/run-replays.ts --cohort outputs/frozen/cohort.json --experiment outputs/frozen/experiment.json --readiness outputs/frozen/readiness.json --corpus data/corpus --output outputs/replays --params params.yaml --ai-review-root ../../ai-review
