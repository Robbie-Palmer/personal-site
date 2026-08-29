from configparser import ConfigParser
from pathlib import Path

import yaml


def test_dvc_remote_is_private_r2_without_committed_credentials() -> None:
    config_path = Path(__file__).parents[1] / ".dvc" / "config"
    parser = ConfigParser()
    parser.read(config_path)

    remote = parser["'remote \"r2\"'"]

    assert remote["url"] == "s3://dvc/wsi-analysis"
    assert remote["endpointurl"].endswith(".r2.cloudflarestorage.com")
    assert remote["region"] == "auto"
    assert not {"access_key_id", "secret_access_key", "password"} & set(remote)


def test_dvc_pipeline_owns_derived_tiles() -> None:
    project_dir = Path(__file__).parents[1]
    pipeline = yaml.safe_load((project_dir / "dvc.yaml").read_text(encoding="utf-8"))
    tile_stage = pipeline["stages"]["tile"]

    assert tile_stage["cmd"] == "uv run --locked wsi-analysis prepare"
    assert tile_stage["params"] == ["tiling"]
    assert tile_stage["outs"] == ["data/tiles"]
    assert "data/wsi" in tile_stage["deps"]
    assert not (project_dir / "data/tiles.dvc").exists()
