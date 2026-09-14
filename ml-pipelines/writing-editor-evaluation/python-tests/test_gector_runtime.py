from pathlib import Path

import pytest

from python.gector_runtime import (
    apply_edits,
    apply_transformation,
    document_segments,
    project_path,
    read_padded_vocabulary,
    read_vocabulary,
    reconstruct_segment,
    split_line,
)


def test_limits_runtime_paths_to_the_project_root(tmp_path: Path) -> None:
    inside = tmp_path / "data" / "input.json"

    assert project_path(inside, tmp_path) == inside
    with pytest.raises(ValueError, match="outside the project root"):
        project_path(tmp_path.parent / "outside.json", tmp_path)


def test_reads_allennlp_padded_vocabulary_indexes(tmp_path: Path) -> None:
    vocabulary = tmp_path / "d_tags.txt"
    vocabulary.write_text("CORRECT\nINCORRECT\n@@UNKNOWN@@\n@@PADDING@@\n", encoding="utf-8")

    assert read_padded_vocabulary(vocabulary) == {
        "CORRECT": 1,
        "INCORRECT": 2,
        "@@UNKNOWN@@": 3,
        "@@PADDING@@": 4,
    }


def test_reads_non_padded_label_vocabulary_by_line_number(tmp_path: Path) -> None:
    vocabulary = tmp_path / "labels.txt"
    vocabulary.write_text("$KEEP\n$DELETE\n", encoding="utf-8")

    assert read_vocabulary(vocabulary, padded=False) == ["$KEEP", "$DELETE"]


def test_applies_model_edits_with_the_legacy_index_convention() -> None:
    tokens = ["This", "are", "test"]
    edits = [
        (1, 2, "$REPLACE_is", 0.99),
        (3, 3, "$APPEND_.", 0.98),
    ]

    assert apply_edits(tokens, edits, {}) == ["This", "is", "test", "."]


def test_applies_case_agreement_and_pinned_verb_transforms() -> None:
    verbs = {"go_VB_VBD": "went"}

    assert apply_transformation("WORD", "$TRANSFORM_CASE_LOWER", verbs) == "word"
    assert apply_transformation("cat", "$TRANSFORM_AGREEMENT_PLURAL", verbs) == "cats"
    assert apply_transformation("go", "$TRANSFORM_VERB_VB_VBD", verbs) == "went"


def test_preserves_line_boundaries_around_inference_content() -> None:
    assert split_line("  Sentence here.  \r\n") == (
        "  ",
        "Sentence here.",
        "  ",
        "\r\n",
    )


def test_segments_hard_wrapped_prose_but_skips_markdown_structure() -> None:
    source = """---
title: Fixture
---

# Heading

The prototype sends a score
but does not stop.

```ts
const broken = "are";
```
"""

    segments = document_segments(source, max_tokens=50)

    assert [segment.tokens for segment in segments] == [
        ["The", "prototype", "sends", "a", "score", "but", "does", "not", "stop."],
    ]


def test_reconstructs_model_tokens_without_changing_hard_wraps() -> None:
    source = "The prototype sends a score\nbut does not stop."

    generated = reconstruct_segment(
        source,
        ["The", "prototype", "sends", "a", "score", "but", "does", "not", "stop", "."],
    )

    assert generated == source
