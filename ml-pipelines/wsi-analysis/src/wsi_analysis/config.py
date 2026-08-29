from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_DIR = Path(__file__).resolve().parents[2]


class PipelineSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_DIR / ".env",
        env_file_encoding="utf-8",
        env_prefix="WSI_",
        extra="ignore",
        validate_default=True,
    )

    data_dir: Path = PROJECT_DIR / "data"
    dataset_card: Path = PROJECT_DIR / "dataset.json"
    inventory_path: Path = PROJECT_DIR / "artifacts" / "dataset-inventory.json"
    tile_size: Annotated[int, Field(gt=0, le=8192)] = 256
    batch_size: Annotated[int, Field(gt=0, le=1024)] = 32
    workers: Annotated[int, Field(gt=0, le=256)] = Field(
        default_factory=lambda: min(8, os.cpu_count() or 1)
    )

    @property
    def wsi_dir(self) -> Path:
        return self.data_dir / "wsi"

    @property
    def tile_dir(self) -> Path:
        return self.data_dir / "tiles"
