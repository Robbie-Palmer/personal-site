from pathlib import Path

import pytest

from tests.support import create_dataset, set_environment


def case_valid(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[list[str], int]:
    set_environment(monkeypatch, create_dataset(tmp_path))
    return ["validate"], 0


def case_valid_images(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[list[str], int]:
    set_environment(monkeypatch, create_dataset(tmp_path))
    return ["validate", "--verify-images"], 0


def case_missing_wsi(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[list[str], int]:
    dataset = create_dataset(tmp_path)
    set_environment(monkeypatch, dataset)
    (dataset.data_dir / "wsi" / "slide.dcm").unlink()
    return ["validate"], 1


def case_invalid_card(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[list[str], int]:
    dataset = create_dataset(tmp_path)
    set_environment(monkeypatch, dataset)
    dataset.card.write_text("{}", encoding="utf-8")
    return ["validate"], 2
