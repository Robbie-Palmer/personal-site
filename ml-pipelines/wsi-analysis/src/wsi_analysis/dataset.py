from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from PIL import Image

from wsi_analysis.models import (
    DatasetCard,
    DatasetInventory,
    DirectoryInventory,
    ValidationIssue,
)


def load_dataset_card(path: Path) -> DatasetCard:
    return DatasetCard.model_validate_json(path.read_text(encoding="utf-8"))


def inventory_directory(path: Path, *, relative_to: Path) -> DirectoryInventory:
    extensions: Counter[str] = Counter()
    files = 0
    byte_count = 0
    symlinks = 0
    broken_symlinks = 0
    absolute_symlinks = 0

    if path.exists():
        for item in path.rglob("*"):
            if item.is_symlink():
                symlinks += 1
                target = item.readlink()
                absolute_symlinks += int(target.is_absolute())
                broken_symlinks += int(not item.exists())
            elif item.is_file():
                files += 1
                byte_count += item.stat().st_size
                extensions[item.suffix.lower() or "<none>"] += 1

    return DirectoryInventory(
        path=path.relative_to(relative_to).as_posix(),
        files=files,
        bytes=byte_count,
        symlinks=symlinks,
        broken_symlinks=broken_symlinks,
        absolute_symlinks=absolute_symlinks,
        extensions=dict(sorted(extensions.items())),
    )


def build_inventory(card: DatasetCard, data_dir: Path) -> DatasetInventory:
    return DatasetInventory(
        dataset=card.name,
        collection_id=card.collection_id,
        directories={
            name: inventory_directory(data_dir / name, relative_to=data_dir.parent)
            for name in ("wsi", "tiles")
        },
    )


def write_inventory(inventory: DatasetInventory, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = inventory.model_dump(mode="json")
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def validate_inventory(inventory: DatasetInventory) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for summary in inventory.directories.values():
        path = Path(summary.path)
        if summary.files == 0:
            issues.append(ValidationIssue(path=path, message="contains no regular files"))
        if summary.broken_symlinks:
            issues.append(
                ValidationIssue(
                    path=path,
                    message=f"contains {summary.broken_symlinks} broken symbolic links",
                )
            )
        if summary.absolute_symlinks:
            issues.append(
                ValidationIssue(
                    path=path,
                    message=f"contains {summary.absolute_symlinks} non-portable absolute links",
                )
            )
    return issues


def validate_pngs(tile_dir: Path) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    pixel_limit = Image.MAX_IMAGE_PIXELS
    try:
        # `verify()` checks the PNG stream without decoding pixels. The dataset
        # includes intentional whole-slide mosaics larger than Pillow's normal
        # interactive-image limit, so the limit is disabled only for this
        # non-decoding integrity pass and restored before returning.
        Image.MAX_IMAGE_PIXELS = None
        for path in sorted(tile_dir.rglob("*.png")):
            try:
                with Image.open(path) as image:
                    image.verify()
            except (OSError, SyntaxError) as error:
                issues.append(ValidationIssue(path=path, message=str(error)))
    finally:
        Image.MAX_IMAGE_PIXELS = pixel_limit
    return issues
