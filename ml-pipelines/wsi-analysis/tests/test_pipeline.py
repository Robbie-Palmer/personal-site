from pathlib import Path
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from wsi_analysis.config import PipelineSettings
from wsi_analysis.pipeline import load_pipeline_parameters, prepare_tiles


def _parameters(path: Path, *, slide: str = "data/wsi/slide.dcm") -> Path:
    path.write_text(
        "\n".join(
            (
                "tiling:",
                f"  slide: {slide}",
                "  output: data/tiles/slide",
                "  tile_size: 256",
                "  batch_size: 32",
            )
        ),
        encoding="utf-8",
    )
    return path


def test_prepare_tiles_resolves_parameters_from_project_root(tmp_path: Path) -> None:
    parameters = _parameters(tmp_path / "params.yaml")
    settings = PipelineSettings(workers=3)

    with (
        patch("wsi_analysis.pipeline.extract_tiles", return_value=11) as extract,
        patch("wsi_analysis.pipeline.build_pyramid", return_value=7) as pyramid,
    ):
        result = prepare_tiles(parameters, settings=settings, project_dir=tmp_path)

    output = tmp_path / "data/tiles/slide"
    assert result == (11, 7, output)
    extract.assert_called_once_with(
        tmp_path / "data/wsi/slide.dcm",
        output,
        tile_size=256,
        batch_size=32,
        workers=3,
    )
    pyramid.assert_called_once_with(
        output / "0",
        output / "pyramid",
        workers=3,
    )


def test_pipeline_parameters_reject_parent_traversal(tmp_path: Path) -> None:
    parameters = _parameters(tmp_path / "params.yaml", slide="../slide.dcm")

    with pytest.raises(ValidationError, match="parent traversal"):
        load_pipeline_parameters(parameters)


def test_pipeline_parameters_reject_untracked_output(tmp_path: Path) -> None:
    parameters = _parameters(tmp_path / "params.yaml")
    content = parameters.read_text(encoding="utf-8").replace("data/tiles/slide", "artifacts/slide")
    parameters.write_text(content, encoding="utf-8")

    with pytest.raises(ValidationError, match="inside data/tiles"):
        load_pipeline_parameters(parameters)
