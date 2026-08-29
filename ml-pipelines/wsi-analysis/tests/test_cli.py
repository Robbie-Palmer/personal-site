from pathlib import Path
from unittest.mock import patch

import pytest
from pytest_cases import parametrize_with_cases

from tests.support import create_dataset, set_environment
from wsi_analysis.cli import main


def test_inventory_command(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    dataset = create_dataset(tmp_path)
    set_environment(monkeypatch, dataset)
    output = tmp_path / "inventory.json"

    assert main(["inventory", "--output", str(output)]) == 0
    assert '"dataset": "test-dataset"' in output.read_text(encoding="utf-8")


@parametrize_with_cases("command,expected_exit_code")
def test_validation_commands(command: list[str], expected_exit_code: int) -> None:
    assert main(command) == expected_exit_code


def test_tile_command_uses_validated_settings(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    dataset = create_dataset(tmp_path)
    set_environment(monkeypatch, dataset)
    slide = dataset.data_dir / "wsi" / "slide.dcm"
    output = dataset.data_dir / "tiles" / "new-slide"

    with patch("wsi_analysis.cli.extract_tiles", return_value=7) as extract:
        assert main(["tile", str(slide), str(output)]) == 0

    extract.assert_called_once_with(
        slide,
        output,
        tile_size=256,
        batch_size=32,
        workers=8,
        overwrite=False,
    )
