from pathlib import Path
from types import TracebackType
from typing import ClassVar, Self
from unittest.mock import patch

import pytest
from PIL import Image
from pytest_cases import fixture, fixture_union, parametrize_with_cases

from wsi_analysis.tiling import batched, build_pyramid, extract_tiles, plan_batches


class FakeSlide:
    properties: ClassVar[dict[str, str]] = {}
    level_dimensions = ((4, 4), (2, 2))
    level_downsamples = (1.0, 2.0)

    def __init__(self, _path: Path) -> None:
        pass

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc_value: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        pass

    def read_region(
        self, _location: tuple[int, int], _level: int, size: tuple[int, int]
    ) -> Image.Image:
        return Image.new("RGBA", size)


class VendorTiledSlide(FakeSlide):
    properties: ClassVar[dict[str, str]] = {
        "openslide.level[0].tile-width": "4",
        "openslide.level[0].tile-height": "4",
    }


type SlidePlan = tuple[type[FakeSlide], tuple[int, int], int]


@fixture
def fallback_slide_plan() -> SlidePlan:
    return FakeSlide, (2, 2), 3


@fixture
def vendor_slide_plan() -> SlidePlan:
    return VendorTiledSlide, (4, 4), 2


slide_plan = fixture_union("slide_plan", [fallback_slide_plan, vendor_slide_plan])


def test_batched_preserves_order_and_remainder() -> None:
    assert list(batched([1, 2, 3, 4, 5], 2)) == [(1, 2), (3, 4), (5,)]


@parametrize_with_cases("source,expected_counts", prefix="pyramid_")
def test_build_pyramid_is_resumable(source: Path, expected_counts: dict[int, int]) -> None:
    output = source.parent / "pyramid"

    first_count = build_pyramid(source, output, tile_size=2, workers=2)
    second_count = build_pyramid(source, output, tile_size=2, workers=2)

    actual_counts = {
        int(level.name): len(list(level.glob("*.png")))
        for level in output.iterdir()
        if level.is_dir()
    }
    assert first_count == sum(expected_counts.values())
    assert second_count == 0
    assert actual_counts == expected_counts
    assert not list(output.rglob("*.tmp"))


def test_plan_batches_supports_fallback_and_vendor_tiles(
    tmp_path: Path, slide_plan: SlidePlan
) -> None:
    slide = tmp_path / "slide.dcm"
    slide.write_bytes(b"fixture")
    slide_class, expected_tile_size, expected_batch_count = slide_plan

    with patch("wsi_analysis.tiling.OpenSlide", slide_class):
        batches = plan_batches(slide, tmp_path / "tiles", tile_size=2, batch_size=3)

    assert len(batches) == expected_batch_count
    assert batches[0].tile_size == expected_tile_size
    assert batches[-1].downsample == 2.0


def test_extract_tiles_writes_atomically_and_resumes(tmp_path: Path) -> None:
    slide = tmp_path / "slide.dcm"
    output = tmp_path / "tiles"
    slide.write_bytes(b"fixture")

    with patch("wsi_analysis.tiling.OpenSlide", FakeSlide):
        first_count = extract_tiles(slide, output, tile_size=2, batch_size=2, workers=2)
        second_count = extract_tiles(slide, output, tile_size=2, batch_size=2, workers=2)

    assert first_count == 5
    assert second_count == 0
    assert len(list(output.rglob("*.png"))) == 5
    assert list(output.rglob("*.tmp")) == []


def test_extract_tiles_rejects_missing_slide(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="Slide does not exist"):
        extract_tiles(
            tmp_path / "missing.dcm",
            tmp_path / "tiles",
            tile_size=2,
            batch_size=2,
            workers=1,
        )
