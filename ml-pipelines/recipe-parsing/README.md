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
