# Recipe Parsing

ML pipeline for parsing recipe images.

See the [ml-pipelines README](../README.md) for DVC setup and credentials.

## Data

Recipe images are tracked by DVC in `data/recipe-images/`. After setting up credentials:

```bash
mise x -- dvc pull    # download data
mise x -- dvc push    # upload after adding new images
```

## Project Structure

```text
recipe-parsing/
├── .dvc/
│   ├── config          # Remote configuration (committed)
│   └── config.local    # Credentials (git-ignored)
├── data/
│   ├── recipe-images/              # Image data (tracked by DVC, not git)
│   ├── ground-truth.json           # Ground truth annotations
│   └── canonical-ingredients.json  # Canonical ingredient registry
└── README.md
```

## Pipeline Stages

### 1. Parse

`parse` runs multimodal recipe extraction through OpenRouter using the OpenAI SDK.

Required environment variables:

- `OPENROUTER_API_KEY`

Optional environment variables:

- `OPENROUTER_MODEL` (default: `google/gemini-3-flash-preview`)
- `PARSE_REQUEST_TIMEOUT_MS` (default: `30000`)
- `PARSE_MAX_RETRIES` (default: `2`)
- `PARSE_CONCURRENCY` (default: `8`)
- `PARSE_RETRY_BASE_DELAY_MS` (default: `500`)
- `PARSE_RETRY_MAX_DELAY_MS` (default: `8000`)
- `PARSE_IMAGE_MAX_DIM` (default: `1600`)
- `PARSE_IMAGE_JPEG_QUALITY` (default: `80`)

`parse.ts` loads environment variables from a local `.env` file automatically
(using `dotenv`), so project-specific settings can live in
`ml-pipelines/recipe-parsing/.env`.

Outputs:

- `outputs/predictions.json`: successful, schema-valid predictions
- `outputs/parse-failures.json`: skipped entry diagnostics after retry exhaustion

### 2. Evaluate Extraction

`evaluate_extraction` compares raw parser output against `rawExpected` ground
truth annotations. This measures how well the parser reads recipe images before
any canonicalization. Entries without `rawExpected` are skipped.

Outputs:

- `outputs/extraction-metrics.json`: aggregate extraction quality metrics
- `outputs/extraction-per-image-scores.json`: per-entry extraction scores

### 3. Canonicalize

`canonicalize` maps parsed ingredient slugs to the canonical ingredient registry
in `data/canonical-ingredients.json`.

Outputs:

- `outputs/predictions-canonicalized.json`: predictions with canonical ingredient slugs
- `outputs/canonicalization-decisions.json`: per-ingredient canonicalization decisions

### 4. Evaluate

`evaluate` compares canonicalized predictions against `expected` (canonical)
ground truth. This is the end-to-end metric.

Outputs:

- `outputs/metrics.json`: aggregate end-to-end metrics
- `outputs/per-image-scores.json`: per-entry end-to-end scores

## Running the Pipeline

Prefer DVC orchestration over manually chaining every script.

Run the core pipeline end-to-end:

```bash
dvc repro prepare parse evaluate_extraction canonicalize evaluate
```

Run an individual stage:

```bash
dvc repro parse
```
