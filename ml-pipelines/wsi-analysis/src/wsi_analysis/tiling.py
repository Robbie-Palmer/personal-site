from __future__ import annotations

import math
import os
import shutil
from collections.abc import Iterable, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from openslide import OpenSlide
from PIL import Image


@dataclass(frozen=True, slots=True)
class TileBatch:
    coordinates: tuple[tuple[int, int], ...]
    level: int
    tile_size: tuple[int, int]
    downsample: float
    output_dir: Path


def batched[T](items: Sequence[T], size: int) -> Iterable[tuple[T, ...]]:
    for offset in range(0, len(items), size):
        yield tuple(items[offset : offset + size])


def _tile_dimensions(slide: OpenSlide, level: int, fallback: int) -> tuple[int, int]:
    width = slide.properties.get(f"openslide.level[{level}].tile-width")
    height = slide.properties.get(f"openslide.level[{level}].tile-height")
    if width is None or height is None:
        return fallback, fallback
    return int(width), int(height)


def plan_batches(
    slide_path: Path, output_dir: Path, *, tile_size: int, batch_size: int
) -> list[TileBatch]:
    batches: list[TileBatch] = []
    with OpenSlide(slide_path) as slide:
        for level, (width, height) in enumerate(slide.level_dimensions):
            dimensions = _tile_dimensions(slide, level, tile_size)
            tile_width, tile_height = dimensions
            coordinates = [
                (x, y) for y in range(0, height, tile_height) for x in range(0, width, tile_width)
            ]
            level_dir = output_dir / str(level)
            batches.extend(
                TileBatch(
                    coordinates=coordinates_batch,
                    level=level,
                    tile_size=dimensions,
                    downsample=float(slide.level_downsamples[level]),
                    output_dir=level_dir,
                )
                for coordinates_batch in batched(coordinates, batch_size)
            )
    return batches


def _extract_batch(slide_path: Path, batch: TileBatch, *, overwrite: bool) -> int:
    batch.output_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    with OpenSlide(slide_path) as slide:
        for x, y in batch.coordinates:
            output_path = batch.output_dir / f"{x}_{y}.png"
            if output_path.exists() and not overwrite:
                continue
            level_zero_location = (
                math.floor(x * batch.downsample),
                math.floor(y * batch.downsample),
            )
            temporary_path = output_path.with_suffix(".png.tmp")
            with slide.read_region(level_zero_location, batch.level, batch.tile_size) as image:
                image.save(temporary_path, format="PNG")
            temporary_path.replace(output_path)
            written += 1
    return written


def _coordinate_tiles(path: Path, tile_size: int) -> dict[tuple[int, int], Path]:
    tiles: dict[tuple[int, int], Path] = {}
    for tile_path in sorted(path.glob("*.png")):
        try:
            pixel_x, pixel_y = (int(part) for part in tile_path.stem.split("_", maxsplit=1))
        except ValueError:
            continue
        if pixel_x % tile_size or pixel_y % tile_size:
            msg = f"Tile coordinates must be divisible by {tile_size}: {tile_path}"
            raise ValueError(msg)
        tiles[pixel_x // tile_size, pixel_y // tile_size] = tile_path
    if not tiles:
        msg = f"No coordinate-named PNG tiles found in {path}"
        raise ValueError(msg)
    return tiles


def _link_tile(source: Path, output: Path) -> bool:
    if output.exists():
        return False
    temporary = output.with_suffix(".png.tmp")
    temporary.unlink(missing_ok=True)
    try:
        os.link(source, temporary)
    except OSError:
        shutil.copyfile(source, temporary)
    temporary.replace(output)
    return True


def _downsample_tile(
    parent: tuple[int, int],
    children: dict[tuple[int, int], Path],
    output_dir: Path,
    tile_size: int,
) -> tuple[tuple[int, int], Path, bool]:
    parent_x, parent_y = parent
    output = output_dir / f"{parent_x}_{parent_y}.png"
    if output.exists():
        return parent, output, False

    canvas = Image.new("RGBA", (tile_size * 2, tile_size * 2), (0, 0, 0, 0))
    for offset_y in range(2):
        for offset_x in range(2):
            child = children.get((parent_x * 2 + offset_x, parent_y * 2 + offset_y))
            if child is None:
                continue
            with Image.open(child) as image:
                canvas.paste(image, (offset_x * tile_size, offset_y * tile_size))

    temporary = output.with_suffix(".png.tmp")
    temporary.unlink(missing_ok=True)
    with canvas.resize((tile_size, tile_size), Image.Resampling.LANCZOS) as tile:
        tile.save(temporary, format="PNG")
    temporary.replace(output)
    return parent, output, True


def build_pyramid(
    source_dir: Path,
    output_dir: Path,
    *,
    tile_size: int,
    workers: int,
) -> int:
    source_tiles = _coordinate_tiles(source_dir, tile_size)
    max_dimension = max(max(x for x, _ in source_tiles), max(y for _, y in source_tiles)) + 1
    maximum_zoom = math.ceil(math.log2(max_dimension))
    high_resolution_dir = output_dir / str(maximum_zoom)
    high_resolution_dir.mkdir(parents=True, exist_ok=True)

    written = sum(
        _link_tile(source, high_resolution_dir / f"{x}_{y}.png")
        for (x, y), source in source_tiles.items()
    )
    current_tiles = {
        coordinate: high_resolution_dir / f"{coordinate[0]}_{coordinate[1]}.png"
        for coordinate in source_tiles
    }

    for zoom in range(maximum_zoom - 1, -1, -1):
        output_level = output_dir / str(zoom)
        output_level.mkdir(parents=True, exist_ok=True)
        parents = sorted({(x // 2, y // 2) for x, y in current_tiles})
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [
                executor.submit(
                    _downsample_tile,
                    parent,
                    current_tiles,
                    output_level,
                    tile_size,
                )
                for parent in parents
            ]
            results = [future.result() for future in as_completed(futures)]
        current_tiles = {coordinate: path for coordinate, path, _ in results}
        written += sum(created for _, _, created in results)

    return written


def extract_tiles(
    slide_path: Path,
    output_dir: Path,
    *,
    tile_size: int,
    batch_size: int,
    workers: int,
    overwrite: bool = False,
) -> int:
    if not slide_path.is_file():
        msg = f"Slide does not exist: {slide_path}"
        raise FileNotFoundError(msg)

    batches = plan_batches(slide_path, output_dir, tile_size=tile_size, batch_size=batch_size)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(_extract_batch, slide_path, batch, overwrite=overwrite)
            for batch in batches
        ]
        return sum(future.result() for future in as_completed(futures))
