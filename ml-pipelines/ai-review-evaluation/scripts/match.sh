#!/usr/bin/env bash
set -euo pipefail

pnpm exec tsx src/match-replays.ts --cohort outputs/frozen/cohort.json --matching outputs/frozen/matching.json --replays outputs/replays --output outputs/matched
