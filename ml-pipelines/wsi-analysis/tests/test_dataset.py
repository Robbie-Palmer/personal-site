from pathlib import Path

import pytest
from PIL import Image
from pytest_cases import parametrize_with_cases

from tests.support import create_dataset
from wsi_analysis.dataset import (
    build_inventory,
    load_dataset_card,
    validate_inventory,
    validate_pngs,
    write_inventory,
)
from wsi_analysis.models import DatasetInventory


def test_inventory_is_deterministic_and_counts_files(tmp_path: Path) -> None:
    dataset = create_dataset(tmp_path)
    card = load_dataset_card(dataset.card)

    inventory = build_inventory(card, dataset.data_dir)
    output = tmp_path / "inventory.json"
    write_inventory(inventory, output)

    assert inventory.directories["wsi"].extensions == {".dcm": 1}
    assert inventory.directories["tiles"].files == 1
    assert '"dataset": "test-dataset"' in output.read_text(encoding="utf-8")
    assert validate_inventory(inventory) == []
    assert validate_pngs(dataset.data_dir / "tiles") == []


@parametrize_with_cases("inventory,expected_messages", prefix="inventory_")
def test_inventory_validation(inventory: DatasetInventory, expected_messages: set[str]) -> None:
    issues = validate_inventory(inventory)
    assert {issue.message for issue in issues} == expected_messages


@parametrize_with_cases("directory,expected_paths", prefix="png_")
def test_png_validation(directory: Path, expected_paths: set[Path]) -> None:
    issues = validate_pngs(directory)
    assert {issue.path for issue in issues} == expected_paths


def test_png_validation_restores_pillow_pixel_limit(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    path = tmp_path / "large-for-test-limit.png"
    Image.new("RGB", (2, 2)).save(path)
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)

    assert validate_pngs(tmp_path) == []
    assert Image.MAX_IMAGE_PIXELS == 1
