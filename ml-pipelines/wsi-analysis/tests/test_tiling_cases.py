from pathlib import Path

from PIL import Image


def pyramid_single_tile(tmp_path: Path) -> tuple[Path, dict[int, int]]:
    source = tmp_path / "native"
    source.mkdir()
    Image.new("RGBA", (2, 2), "red").save(source / "0_0.png")
    return source, {0: 1}


def pyramid_sparse_grid(tmp_path: Path) -> tuple[Path, dict[int, int]]:
    source = tmp_path / "native"
    source.mkdir()
    for coordinate, colour in (("0_0", "red"), ("2_0", "green"), ("0_2", "blue")):
        Image.new("RGBA", (2, 2), colour).save(source / f"{coordinate}.png")
    return source, {0: 1, 1: 3}
