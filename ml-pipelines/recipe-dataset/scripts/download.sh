#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "$0")/.." && pwd)
raw_dir="$project_root/data/raw"
mkdir -p "$raw_dir"

download() {
  local url="$1"
  local destination="$2"
  local temporary="${destination}.part"
  mkdir -p "$(dirname "$destination")"
  if [[ -s "$destination" ]]; then
    echo "Already downloaded: ${destination#"$project_root/"}"
    return
  fi
  curl --fail --location --retry 5 --retry-all-errors --continue-at - \
    --output "$temporary" "$url"
  mv "$temporary" "$destination"
}

download \
  "https://www.kaggle.com/api/v1/datasets/download/prashantsingh001/recipes-dataset-64k-dishes" \
  "$raw_dir/kaggle-64k/archive.zip"
download \
  "https://github.com/thenaterhood/fossrecipes/archive/a6d8d27ba1cd7a2dcaf4dc5d84b7d5a7ab0eaf9c.tar.gz" \
  "$raw_dir/fossrecipes/a6d8d27ba1cd7a2dcaf4dc5d84b7d5a7ab0eaf9c.tar.gz"
download \
  "https://huggingface.co/datasets/gossminn/wikibooks-cookbook/resolve/49fb73ea07d2a1380c15197db5589934937457ed/recipes_parsed.json" \
  "$raw_dir/wikibooks-cookbook/recipes_parsed.json"
download \
  "https://github.com/fictive-kin/openrecipes/archive/f0f7acb1ed23098258f198b2496f53aa0e8cfe3f.tar.gz" \
  "$raw_dir/openrecipes/source-f0f7acb1ed23098258f198b2496f53aa0e8cfe3f.tar.gz"
download \
  "https://openrecipes.s3.amazonaws.com/recipeitems-latest.json.gz" \
  "$raw_dir/openrecipes/recipeitems-latest.json.gz"
download \
  "https://gitlab.com/koha-community/koha-cookbook/-/archive/908b2244/koha-cookbook-908b2244.tar.gz" \
  "$raw_dir/koha-cookbook/908b2244.tar.gz"
download \
  "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2025/2025-09-16/all_recipes.csv" \
  "$raw_dir/tastyr/all_recipes.csv"
download \
  "https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2025/2025-09-16/cuisines.csv" \
  "$raw_dir/tastyr/cuisines.csv"

if [[ ! -s "$raw_dir/usda-myplate/recipes.jsonl" ]]; then
  node "$project_root/scripts/download-myplate.mjs"
fi
node "$project_root/scripts/download-gutenberg.mjs"
if [[ ! -s "$raw_dir/icn-child-nutrition/recipes.jsonl" ]]; then
  node "$project_root/scripts/download-icn.mjs"
fi

(
  cd "$raw_dir"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS
)
