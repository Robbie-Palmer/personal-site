"""Modern, AllenNLP-free inference for the pinned GECToR-2024 checkpoint."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import platform
import re
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import torch
from torch import Tensor, nn
from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers import __version__ as transformers_version

START_TOKEN = "$START"  # noqa: S105 - GECToR's sentinel token, not a credential.
KEEP = "$KEEP"
PADDING = "@@PADDING@@"
UNKNOWN = "@@UNKNOWN@@"
ENCODER_PREFIX = "text_field_embedder.token_embedder_bert.bert_model."
LABEL_WEIGHT = "tag_labels_projection_layer._module.weight"
LABEL_BIAS = "tag_labels_projection_layer._module.bias"
DETECT_WEIGHT = "tag_detect_projection_layer._module.weight"
DETECT_BIAS = "tag_detect_projection_layer._module.bias"


@dataclass(frozen=True)
class InferenceParameters:
    batch_size: int
    iterations: int
    max_tokens: int
    min_tokens: int
    min_error_probability: float
    min_token_probability: float
    additional_confidence: float


@dataclass(frozen=True)
class RuntimeDetails:
    python_version: str
    torch_version: str
    transformers_version: str
    cuda_version: str
    device: str
    compute_capability: str


@dataclass(frozen=True)
class TextSegment:
    start: int
    end: int
    tokens: list[str]


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        msg = f"expected a JSON object in {path}"
        raise TypeError(msg)
    return value


def read_vocabulary(path: Path, *, padded: bool) -> list[str]:
    if padded:
        msg = "use read_padded_vocabulary for padded AllenNLP namespaces"
        raise ValueError(msg)
    return path.read_text(encoding="utf-8").splitlines()


def read_padded_vocabulary(path: Path) -> dict[str, int]:
    """Reproduce AllenNLP 0.8.4's serialized padded-namespace indexes."""
    indexes = {PADDING: 0}
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        indexes[UNKNOWN if line == UNKNOWN else line] = index
    return indexes


def read_verb_forms(path: Path) -> dict[str, str]:
    decoded: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        words, tags = line.split(":", maxsplit=1)
        source, target = words.split("_", maxsplit=1)
        source_tag, target_tag = tags.split("_", maxsplit=1)
        decoded.setdefault(f"{source}_{source_tag}_{target_tag}", target)
    return decoded


def apply_transformation(token: str, transform: str, verb_forms: dict[str, str]) -> str:
    if transform.endswith("CASE_LOWER"):
        return token.lower()
    if transform.endswith("CASE_UPPER"):
        return token.upper()
    if transform.endswith("CASE_CAPITAL"):
        return token.capitalize()
    if transform.endswith("CASE_CAPITAL_1"):
        return token[:1] + token[1:].capitalize()
    if transform.endswith("CASE_UPPER_-1"):
        return token[:-1].upper() + token[-1:]
    if transform.startswith("$TRANSFORM_VERB_"):
        return verb_forms.get(f"{token}_{transform.removeprefix('$TRANSFORM_VERB_')}", token)
    if transform.startswith("$TRANSFORM_SPLIT"):
        return " ".join(token.split("-"))
    if transform.endswith("AGREEMENT_PLURAL"):
        return f"{token}s"
    if transform.endswith("AGREEMENT_SINGULAR"):
        return token[:-1]
    msg = f"unsupported GECToR transformation: {transform}"
    raise ValueError(msg)


def apply_edits(
    source_tokens: list[str],
    edits: list[tuple[int, int, str, float]],
    verb_forms: dict[str, str],
) -> list[str]:
    target_tokens = source_tokens.copy()
    shift = 0
    for start, end, label, _probability in edits:
        position = start + shift
        source_token = target_tokens[position] if 0 <= position < len(target_tokens) else ""
        if label == "":
            del target_tokens[position]
            shift -= 1
        elif start == end:
            target_tokens[position:position] = [label.removeprefix("$APPEND_")]
            shift += 1
        elif label.startswith("$TRANSFORM_"):
            target_tokens[position] = apply_transformation(source_token, label, verb_forms)
        elif start == end - 1:
            target_tokens[position] = label.removeprefix("$REPLACE_")
        elif label.startswith("$MERGE_"):
            target_tokens[position + 1 : position + 1] = [label]
            shift += 1

    if any(token.startswith("$MERGE_") for token in target_tokens):
        merged = " ".join(target_tokens)
        merged = merged.replace(" $MERGE_HYPHEN ", "-")
        merged = merged.replace(" $MERGE_SPACE ", "")
        return merged.split()
    return target_tokens


class GectorModel:
    def __init__(self, model_directory: Path, parameters: InferenceParameters) -> None:
        if not torch.cuda.is_available():
            msg = "run_gector requires a CUDA GPU"
            raise RuntimeError(msg)
        self.device = torch.device("cuda:0")
        torch.manual_seed(0)
        torch.cuda.manual_seed_all(0)
        torch.use_deterministic_algorithms(True)
        torch.backends.cuda.matmul.allow_tf32 = False
        self.parameters = parameters
        namespace_patterns = (
            model_directory / "vocabulary/non_padded_namespaces.txt"
        ).read_text(encoding="utf-8").splitlines()
        for namespace in ("labels", "d_tags"):
            if not any(fnmatch.fnmatchcase(namespace, pattern) for pattern in namespace_patterns):
                msg = f"checkpoint namespace {namespace} must be non-padded"
                raise RuntimeError(msg)
        self.labels = read_vocabulary(model_directory / "vocabulary/labels.txt", padded=False)
        detect_labels = read_vocabulary(
            model_directory / "vocabulary/d_tags.txt",
            padded=False,
        )
        self.incorrect_index = detect_labels.index("INCORRECT")
        self.verb_forms = read_verb_forms(model_directory / "verb-form-vocab.txt")

        encoder_directory = model_directory / "roberta-large"
        self.tokenizer = AutoTokenizer.from_pretrained(
            encoder_directory,
            local_files_only=True,
            use_fast=True,
        )
        if not self.tokenizer.is_fast:
            msg = "the pinned RoBERTa tokenizer must support offset mappings"
            raise RuntimeError(msg)
        added = self.tokenizer.add_tokens([START_TOKEN])
        if added != 1 or len(self.tokenizer) != 50_266:
            msg = "the pinned tokenizer did not assign the expected GECToR start token"
            raise RuntimeError(msg)

        config = AutoConfig.from_pretrained(encoder_directory, local_files_only=True)
        self.encoder = AutoModel.from_config(config)
        self.encoder.resize_token_embeddings(len(self.tokenizer), mean_resizing=False)
        self.label_projection = nn.Linear(config.hidden_size, len(self.labels))
        self.detect_projection = nn.Linear(config.hidden_size, len(detect_labels))
        self._load_checkpoint(model_directory / "gector-2024-roberta-large.th")
        self.encoder.to(self.device).eval()
        self.label_projection.to(self.device).eval()
        self.detect_projection.to(self.device).eval()

    def _load_checkpoint(self, checkpoint: Path) -> None:
        state = torch.load(checkpoint, map_location="cpu", mmap=True, weights_only=True)
        encoder_state = {
            key.removeprefix(ENCODER_PREFIX): value
            for key, value in state.items()
            if key.startswith(ENCODER_PREFIX)
        }
        incompatible = self.encoder.load_state_dict(encoder_state, strict=False)
        if incompatible.missing_keys or incompatible.unexpected_keys != ["embeddings.position_ids"]:
            msg = (
                "checkpoint encoder keys do not match the locked runtime: "
                f"missing={incompatible.missing_keys}, unexpected={incompatible.unexpected_keys}"
            )
            raise RuntimeError(msg)
        with torch.no_grad():
            self.label_projection.weight.copy_(state[LABEL_WEIGHT])
            self.label_projection.bias.copy_(state[LABEL_BIAS])
            self.detect_projection.weight.copy_(state[DETECT_WEIGHT])
            self.detect_projection.bias.copy_(state[DETECT_BIAS])
        del state

    def runtime_details(self) -> RuntimeDetails:
        major, minor = torch.cuda.get_device_capability(self.device)
        return RuntimeDetails(
            python_version=platform.python_version(),
            torch_version=torch.__version__,
            transformers_version=transformers_version,
            cuda_version=torch.version.cuda or "unavailable",
            device="cuda",
            compute_capability=f"{major}.{minor}",
        )

    def _encode(self, batch: list[list[str]]) -> tuple[Tensor, Tensor, Tensor, Tensor]:
        truncated = [[START_TOKEN, *tokens[: self.parameters.max_tokens]] for tokens in batch]
        texts = [" ".join(tokens) for tokens in truncated]
        encoded = self.tokenizer(
            texts,
            add_special_tokens=False,
            return_offsets_mapping=True,
        )
        rows: list[list[int]] = []
        token_offsets: list[list[int]] = []
        for words, text, input_ids, bpe_offsets in zip(
            truncated,
            texts,
            encoded["input_ids"],
            encoded["offset_mapping"],
            strict=True,
        ):
            word_spans: list[tuple[int, int]] = []
            cursor = 0
            for word in words:
                start = text.index(word, cursor)
                end = start + len(word)
                word_spans.append((start, end))
                cursor = end

            kept_ids: list[int] = []
            starts: list[int] = []
            bpe_cursor = 0
            for word_start, word_end in word_spans:
                group: list[int] = []
                while bpe_cursor < len(bpe_offsets):
                    bpe_start, bpe_end = bpe_offsets[bpe_cursor]
                    if bpe_start >= word_start and bpe_end <= word_end:
                        if len(group) < 5:
                            group.append(input_ids[bpe_cursor])
                        bpe_cursor += 1
                    elif bpe_start >= word_end:
                        break
                    else:
                        bpe_cursor += 1
                if not group:
                    msg = f"tokenizer produced no pieces for {text[word_start:word_end]!r}"
                    raise RuntimeError(msg)
                starts.append(len(kept_ids))
                kept_ids.extend(group)
            rows.append(kept_ids)
            token_offsets.append(starts)

        max_pieces = max(map(len, rows))
        max_words = max(map(len, token_offsets))
        input_tensor = torch.zeros((len(rows), max_pieces), dtype=torch.long, device=self.device)
        offset_tensor = torch.zeros((len(rows), max_words), dtype=torch.long, device=self.device)
        token_mask = torch.zeros((len(rows), max_words), dtype=torch.bool, device=self.device)
        for index, (row, offsets) in enumerate(zip(rows, token_offsets, strict=True)):
            input_tensor[index, : len(row)] = torch.tensor(row, device=self.device)
            offset_tensor[index, : len(offsets)] = torch.tensor(offsets, device=self.device)
            token_mask[index, : len(offsets)] = True
        return input_tensor, input_tensor.ne(0).long(), offset_tensor, token_mask

    @torch.inference_mode()
    def _predict(self, batch: list[list[str]]) -> tuple[Tensor, Tensor, Tensor]:
        input_ids, attention_mask, offsets, token_mask = self._encode(batch)
        hidden = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        batch_indexes = torch.arange(hidden.shape[0], device=self.device).unsqueeze(1)
        token_hidden = hidden[batch_indexes, offsets]
        label_probabilities = self.label_projection(token_hidden).softmax(dim=-1)
        if self.parameters.additional_confidence > 0:
            label_probabilities[:, :, 0] += self.parameters.additional_confidence
        detect_probabilities = self.detect_projection(token_hidden).softmax(dim=-1)
        error_probability = (
            detect_probabilities[:, :, self.incorrect_index]
            .masked_fill(~token_mask, 0)
            .amax(dim=-1)
        )
        probabilities, indexes = label_probabilities.max(dim=-1)
        return probabilities.cpu(), indexes.cpu(), error_probability.cpu()

    def _postprocess(
        self,
        batch: list[list[str]],
        probabilities: Tensor,
        indexes: Tensor,
        error_probabilities: Tensor,
    ) -> list[list[str]]:
        results: list[list[str]] = []
        for tokens, token_probs, token_indexes, error_probability in zip(
            batch,
            probabilities,
            indexes,
            error_probabilities,
            strict=True,
        ):
            if error_probability.item() < self.parameters.min_error_probability:
                results.append(tokens)
                continue
            edits: list[tuple[int, int, str, float]] = []
            length = min(len(tokens), self.parameters.max_tokens)
            for index in range(length + 1):
                label = self.labels[token_indexes[index].item()]
                probability = token_probs[index].item()
                if (
                    probability < self.parameters.min_token_probability
                    or label in {KEEP, PADDING, UNKNOWN}
                ):
                    continue
                if label == "$DELETE":
                    action = (index - 1, index, "", probability)
                elif label.startswith(("$REPLACE_", "$TRANSFORM_")):
                    action = (index - 1, index, label, probability)
                elif label.startswith(("$APPEND_", "$MERGE_")):
                    action = (index, index, label, probability)
                else:
                    msg = f"unsupported GECToR label: {label}"
                    raise ValueError(msg)
                edits.append(action)
            results.append(apply_edits(tokens, edits, self.verb_forms))
        return results

    def correct(self, sequences: list[list[str]]) -> tuple[list[list[str]], list[int]]:
        final = [tokens.copy() for tokens in sequences]
        histories = [[tokens.copy()] for tokens in sequences]
        active = [
            index
            for index, tokens in enumerate(sequences)
            if len(tokens) >= self.parameters.min_tokens
        ]
        updates = [0 for _ in sequences]
        for _iteration in range(self.parameters.iterations):
            if not active:
                break
            next_active: list[int] = []
            for batch_start in range(0, len(active), self.parameters.batch_size):
                ids = active[batch_start : batch_start + self.parameters.batch_size]
                batch = [final[index] for index in ids]
                prediction = self._postprocess(batch, *self._predict(batch))
                for sequence_id, corrected in zip(ids, prediction, strict=True):
                    if corrected == final[sequence_id]:
                        continue
                    final[sequence_id] = corrected
                    updates[sequence_id] += 1
                    if corrected not in histories[sequence_id]:
                        histories[sequence_id].append(corrected.copy())
                        next_active.append(sequence_id)
            active = next_active
        return final, updates


def split_line(line: str) -> tuple[str, str, str, str]:
    terminator_match = re.search(r"(?:\r\n|\n|\r)$", line)
    terminator = terminator_match.group(0) if terminator_match else ""
    body = line[: -len(terminator)] if terminator else line
    content_match = re.fullmatch(r"(\s*)(.*?)(\s*)", body)
    if content_match is None:
        return "", body, "", terminator
    return (*content_match.groups(), terminator)


def reconstruct_segment(source: str, target_tokens: list[str]) -> str:
    matches = list(re.finditer(r"\S+", source))
    source_tokens = [match.group(0) for match in matches]
    matcher = SequenceMatcher(a=source_tokens, b=target_tokens, autojunk=False)
    target_to_source: dict[int, int] = {}
    for operation, source_start, _source_end, target_start, target_end in matcher.get_opcodes():
        if operation == "equal":
            for offset in range(target_end - target_start):
                target_to_source[target_start + offset] = source_start + offset

    if not target_tokens:
        return ""
    pieces: list[str] = [source[: matches[0].start()] if matches else ""]
    closing_punctuation = re.compile(r"^[,.;:!?%)}\]]+$")
    opening_punctuation = re.compile(r"^[({\[]+$")
    for target_index, token in enumerate(target_tokens):
        if target_index > 0:
            previous_source = target_to_source.get(target_index - 1)
            current_source = target_to_source.get(target_index)
            if (
                previous_source is not None
                and current_source is not None
                and current_source == previous_source + 1
            ):
                separator = source[matches[previous_source].end() : matches[current_source].start()]
            elif previous_source is not None and previous_source + 1 < len(matches):
                separator = source[
                    matches[previous_source].end() : matches[previous_source + 1].start()
                ]
            else:
                separator = " "
            if current_source is None and closing_punctuation.fullmatch(token):
                separator = ""
            if opening_punctuation.fullmatch(target_tokens[target_index - 1]):
                separator = ""
            pieces.append(separator)
        pieces.append(token)
    pieces.append(source[matches[-1].end() :] if matches else "")
    return "".join(pieces)


def document_segments(source: str, max_tokens: int) -> list[TextSegment]:
    lines = list(re.finditer(r"[^\n]*(?:\n|$)", source))
    segments: list[TextSegment] = []
    paragraph_start: int | None = None
    paragraph_end: int | None = None
    in_frontmatter = source.startswith("---\n") or source.startswith("---\r\n")
    in_fence = False

    def flush() -> None:
        nonlocal paragraph_start, paragraph_end
        if paragraph_start is None or paragraph_end is None:
            return
        paragraph = source[paragraph_start:paragraph_end]
        token_matches = list(re.finditer(r"\S+", paragraph))
        offset = 0
        while offset < len(token_matches):
            limit = min(offset + max_tokens, len(token_matches))
            if limit < len(token_matches):
                sentence_end = next(
                    (
                        index + 1
                        for index in range(limit - 1, offset, -1)
                        if re.search(r"[.!?][\]})'\"*_]*$", token_matches[index].group(0))
                    ),
                    limit,
                )
            else:
                sentence_end = limit
            first = token_matches[offset]
            last = token_matches[sentence_end - 1]
            segments.append(
                TextSegment(
                    start=paragraph_start + first.start(),
                    end=paragraph_start + last.end(),
                    tokens=[match.group(0) for match in token_matches[offset:sentence_end]],
                )
            )
            offset = sentence_end
        paragraph_start = None
        paragraph_end = None

    for line_index, line_match in enumerate(lines):
        line = line_match.group(0)
        if not line:
            continue
        _leading, content, _trailing, _terminator = split_line(line)
        stripped = content.strip()
        if in_frontmatter:
            flush()
            if line_index > 0 and stripped == "---":
                in_frontmatter = False
            continue
        if re.match(r"^(?:```|~~~)", stripped):
            flush()
            in_fence = not in_fence
            continue
        if in_fence:
            flush()
            continue
        list_match = re.match(r"^\s*(?:[-*+] |\d+[.)] )", line)
        structural = (
            not stripped
            or re.match(r"^(?:#{1,6}\s|\||>|<|:::)", stripped) is not None
            or re.match(r"^\s{4,}\S", line) is not None
        )
        if structural:
            flush()
            continue
        if list_match:
            flush()
            paragraph_start = line_match.start() + list_match.end()
            paragraph_end = line_match.start() + len(line.rstrip("\r\n "))
            continue
        content_start = line_match.start() + len(line) - len(line.lstrip())
        content_end = line_match.start() + len(line.rstrip("\r\n "))
        if paragraph_start is None:
            paragraph_start = content_start
        paragraph_end = content_end
    flush()
    return segments


def run_job(
    job: dict[str, Any],
    model_directory: Path,
    manifest: dict[str, Any],
    parameters: InferenceParameters,
) -> dict[str, Any]:
    model = GectorModel(model_directory, parameters)
    artifacts = job.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        msg = "inference job needs at least one artifact"
        raise ValueError(msg)

    segments: list[tuple[int, TextSegment]] = []
    artifact_sources: list[str] = []
    for artifact_index, artifact in enumerate(artifacts):
        source_file = Path(artifact["sourceFile"])
        source = source_file.read_text(encoding="utf-8")
        artifact_sources.append(source)
        segments.extend(
            (artifact_index, segment)
            for segment in document_segments(source, parameters.max_tokens)
        )

    corrected, updates = model.correct([segment.tokens for _artifact, segment in segments])
    corrected_lines: list[list[int]] = [[] for _artifact in artifacts]
    update_counts = [0 for _artifact in artifacts]
    replacements: list[list[tuple[int, int, str]]] = [[] for _artifact in artifacts]
    for segment_index, ((artifact_index, segment), target_tokens) in enumerate(
        zip(segments, corrected, strict=True),
    ):
        if segment.tokens == target_tokens:
            continue
        segment_source = artifact_sources[artifact_index][segment.start : segment.end]
        replacements[artifact_index].append(
            (segment.start, segment.end, reconstruct_segment(segment_source, target_tokens))
        )
        corrected_lines[artifact_index].append(
            artifact_sources[artifact_index].count("\n", 0, segment.start) + 1
        )
        update_counts[artifact_index] += updates[segment_index]

    results = []
    for index, artifact in enumerate(artifacts):
        generated = artifact_sources[index]
        for start, end, replacement in sorted(replacements[index], reverse=True):
            generated = f"{generated[:start]}{replacement}{generated[end:]}"
        results.append(
            {
                "artifactId": artifact["artifactId"],
                "generatedText": generated,
                "correctedLines": corrected_lines[index],
                "iterationUpdates": update_counts[index],
            }
        )
    return {
        "schemaVersion": 1,
        "recordType": "gector-raw-inference-run",
        "model": {
            "modelId": manifest["modelId"],
            "sourceRevision": manifest["source"]["revision"],
            "checkpointContentHash": manifest["checkpoint"]["contentHash"],
        },
        "runtime": asdict(model.runtime_details()),
        "parameters": asdict(parameters),
        "artifacts": results,
    }


def parse_parameters(params: dict[str, Any]) -> InferenceParameters:
    producer = params["producers"]["gector"]
    return InferenceParameters(
        batch_size=int(producer["batchSize"]),
        iterations=int(producer["iterations"]),
        max_tokens=int(producer["maxTokens"]),
        min_tokens=int(producer["minTokens"]),
        min_error_probability=float(producer["minErrorProbability"]),
        min_token_probability=float(producer["minTokenProbability"]),
        additional_confidence=float(producer["additionalConfidence"]),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--params", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-generated", type=Path)
    args = parser.parse_args()
    result = run_job(
        read_json(args.job),
        args.model,
        read_json(args.manifest),
        parse_parameters(read_json(args.params)),
    )
    if args.expected_generated is not None:
        expected = args.expected_generated.read_text(encoding="utf-8")
        if len(result["artifacts"]) != 1 or result["artifacts"][0]["generatedText"] != expected:
            msg = "smoke output does not match the pinned expected correction"
            raise RuntimeError(msg)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(result, sort_keys=True, separators=(",", ":"))
    args.output.write_text(f"{serialized}\n", encoding="utf-8")
    print(f"Ran GECToR over {len(result['artifacts'])} artifact(s) on CUDA")


if __name__ == "__main__":
    main()
