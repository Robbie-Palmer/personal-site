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
│   └── recipe-images/  # Image data (tracked by DVC, not git)
└── README.md
```

## Inference

`infer` runs multimodal recipe extraction through OpenRouter using the OpenAI SDK.

Required environment variables:

- `OPENROUTER_API_KEY`

Optional environment variables:

- `OPENROUTER_MODEL` (default: `google/gemini-3-flash-preview`)
- `INFER_MAX_RETRIES` (default: `2`)
- `INFER_CONCURRENCY` (default: `8`)
- `INFER_RETRY_BASE_DELAY_MS` (default: `500`)
- `INFER_RETRY_MAX_DELAY_MS` (default: `8000`)
- `INFER_IMAGE_MAX_DIM` (default: `1600`)
- `INFER_IMAGE_JPEG_QUALITY` (default: `80`)

`infer.ts` loads environment variables from a local `.env` file automatically
(using `dotenv`), so project-specific settings can live in
`ml-pipelines/recipe-parsing/.env`.

Outputs:

- `outputs/predictions.json`: successful, schema-valid predictions
- `outputs/infer-failures.json`: skipped entry diagnostics after retry exhaustion
- `outputs/predictions-normalized.json`: post-processed predictions used for evaluation

## Running the Pipeline

Prefer DVC orchestration over manually chaining every script.

Run the core pipeline end-to-end:

```bash
dvc repro prepare infer normalize evaluate
```

Run an individual stage:

```bash
dvc repro infer
```
