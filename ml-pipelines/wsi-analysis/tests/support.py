import json
from dataclasses import dataclass
from pathlib import Path

import pytest
from PIL import Image


@dataclass(frozen=True, slots=True)
class DatasetPaths:
    data_dir: Path
    card: Path


def create_dataset(tmp_path: Path) -> DatasetPaths:
    data_dir = tmp_path / "data"
    (data_dir / "wsi").mkdir(parents=True)
    (data_dir / "tiles").mkdir(parents=True)
    (data_dir / "wsi" / "slide.dcm").write_bytes(b"dicom")
    Image.new("RGB", (2, 2)).save(data_dir / "tiles" / "tile.png")
    card = tmp_path / "dataset.json"
    card.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "name": "test-dataset",
                "description": "Fixture",
                "collection_id": "test_collection",
                "source": {
                    "name": "Source",
                    "url": "https://example.com",
                    "doi": "10.1234/test",
                },
                "license": {
                    "name": "CC0",
                    "spdx_id": "CC0-1.0",
                    "url": "https://creativecommons.org/publicdomain/zero/1.0/",
                },
                "attribution": "Fixture authors",
                "intended_use": "Tests",
            }
        ),
        encoding="utf-8",
    )
    return DatasetPaths(data_dir=data_dir, card=card)


def set_environment(monkeypatch: pytest.MonkeyPatch, dataset: DatasetPaths) -> None:
    monkeypatch.setenv("WSI_DATA_DIR", str(dataset.data_dir))
    monkeypatch.setenv("WSI_DATASET_CARD", str(dataset.card))
    monkeypatch.setenv("WSI_WORKERS", "8")
