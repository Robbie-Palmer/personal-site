from pathlib import Path

import pytest

from wsi_analysis.config import PipelineSettings


def test_settings_use_wsi_environment_prefix(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("WSI_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("WSI_WORKERS", "3")

    settings = PipelineSettings()

    assert settings.data_dir == tmp_path
    assert settings.wsi_dir == tmp_path / "wsi"
    assert settings.tile_dir == tmp_path / "tiles"
    assert settings.workers == 3
