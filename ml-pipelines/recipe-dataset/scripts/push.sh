#!/usr/bin/env bash
set -euo pipefail

exec bash ../scripts/doppler-pipeline-env uv tool run --from 'dvc[s3]==3.67.1' dvc push
