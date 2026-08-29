from pathlib import Path

from PIL import Image

from tests.support import create_dataset
from wsi_analysis.dataset import build_inventory, load_dataset_card
from wsi_analysis.models import DatasetInventory


def inventory_valid(tmp_path: Path) -> tuple[DatasetInventory, set[str]]:
    dataset = create_dataset(tmp_path)
    card = load_dataset_card(dataset.card)
    return build_inventory(card, dataset.data_dir), set()


def inventory_empty_and_absolute_link(tmp_path: Path) -> tuple[DatasetInventory, set[str]]:
    dataset = create_dataset(tmp_path)
    (dataset.data_dir / "tiles" / "tile.png").unlink()
    (dataset.data_dir / "tiles" / "link.png").symlink_to(dataset.data_dir / "wsi" / "slide.dcm")
    card = load_dataset_card(dataset.card)
    expected = {"contains 1 non-portable absolute links", "contains no regular files"}
    return build_inventory(card, dataset.data_dir), expected


def png_valid(tmp_path: Path) -> tuple[Path, set[Path]]:
    Image.new("RGB", (2, 2)).save(tmp_path / "valid.png")
    return tmp_path, set()


def png_corrupt(tmp_path: Path) -> tuple[Path, set[Path]]:
    corrupt = tmp_path / "broken.png"
    corrupt.write_text("not an image", encoding="utf-8")
    return tmp_path, {corrupt}
