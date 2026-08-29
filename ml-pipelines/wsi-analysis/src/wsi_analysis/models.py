from __future__ import annotations

from pathlib import Path

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DatasetSource(StrictModel):
    name: str = Field(min_length=1)
    url: AnyHttpUrl
    doi: str = Field(pattern=r"^10\.\d{4,9}/\S+$")


class DatasetLicense(StrictModel):
    name: str = Field(min_length=1)
    spdx_id: str = Field(min_length=1)
    url: AnyHttpUrl


class DatasetCard(StrictModel):
    schema_version: int = Field(ge=1)
    name: str = Field(pattern=r"^[a-z0-9][a-z0-9-]+$")
    description: str = Field(min_length=1)
    collection_id: str = Field(pattern=r"^[a-z0-9][a-z0-9_]+$")
    source: DatasetSource
    license: DatasetLicense
    attribution: str = Field(min_length=1)
    intended_use: str = Field(min_length=1)


class DirectoryInventory(StrictModel):
    path: str
    files: int = Field(ge=0)
    bytes: int = Field(ge=0)
    symlinks: int = Field(ge=0)
    broken_symlinks: int = Field(ge=0)
    absolute_symlinks: int = Field(ge=0)
    extensions: dict[str, int]


class DatasetInventory(StrictModel):
    schema_version: int = 1
    dataset: str
    collection_id: str
    directories: dict[str, DirectoryInventory]


class ValidationIssue(StrictModel):
    path: Path
    message: str


class TilingParameters(StrictModel):
    slide: Path
    output: Path
    tile_size: int = Field(gt=0, le=8192)
    batch_size: int = Field(gt=0, le=1024)

    @field_validator("slide", "output")
    @classmethod
    def require_project_relative_path(cls, path: Path) -> Path:
        if path.is_absolute() or ".." in path.parts:
            msg = "must be a project-relative path without parent traversal"
            raise ValueError(msg)
        return path

    @field_validator("slide")
    @classmethod
    def require_wsi_source(cls, path: Path) -> Path:
        if path.parts[:2] != ("data", "wsi"):
            msg = "must be inside data/wsi"
            raise ValueError(msg)
        return path

    @field_validator("output")
    @classmethod
    def require_tile_output(cls, path: Path) -> Path:
        if path.parts[:2] != ("data", "tiles"):
            msg = "must be inside data/tiles"
            raise ValueError(msg)
        return path


class PipelineParameters(StrictModel):
    tiling: TilingParameters
