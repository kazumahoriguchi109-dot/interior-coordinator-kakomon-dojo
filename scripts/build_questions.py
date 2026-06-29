#!/usr/bin/env python3

import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from typing import Any


BLANK_LABELS = ["ア", "イ", "ウ", "エ", "オ", "カ"]


@dataclass
class QuestionItem:
    id: str
    volume: str
    chapter: str
    set_number: int | None
    exam_year: int | None
    exam_round: int | None
    blank_label: str
    prompt: str
    options: list[str]
    answer_index: int | None
    answer_text: str | None
    explanation: str
    keywords: str
    source_pdf: str
    source_page: int
    image_path: str


def normalize_text(text: str) -> str:
    table = str.maketrans(
        {
            "（": "(",
            "）": ")",
            "［": "[",
            "］": "]",
            "【": "[",
            "】": "]",
            "　": " ",
            "“": '"',
            "”": '"',
            "’": "'",
            "，": ",",
            "．": ".",
            "・": "・",
            "／": "/",
            "ー": "ー",
        }
    )
    text = text.translate(table)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def to_ascii_digits(text: str) -> str:
    return text.translate(str.maketrans("０１２３４５６７８９", "0123456789"))


def load_pages(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_page_number(image_path: str) -> int:
    match = re.search(r"-(\d+)\.(?:png|jpg|jpeg)$", image_path)
    return int(match.group(1)) if match else -1


def detect_volume(source_pdf: str) -> str:
    basename = os.path.basename(source_pdf)
    if "(1)" in basename:
        return "上巻"
    if "(2)" in basename:
        return "下巻"
    return "未分類"


def extract_source_pdf(image_path: str) -> str:
    if any(token in image_path for token in ["/upper/", "sample1", "(1)"]):
        return "Kindle_Auto_Export (1).pdf"
    if any(token in image_path for token in ["/lower/", "sample2", "(2)"]):
        return "Kindle_Auto_Export (2).pdf"
    return "unknown.pdf"


def is_question_page(lines: list[dict[str, Any]]) -> bool:
    texts = [normalize_text(to_ascii_digits(line["text"])) for line in lines]
    joined = "\n".join(texts)
    return "解答・解説" in joined and "重要度" in joined and "[語群]" in joined


def parse_metadata(lines: list[dict[str, Any]]) -> tuple[str, int | None, int | None, int | None]:
    chapter = ""
    set_number = None
    exam_year = None
    exam_round = None

    for line in lines:
        text = normalize_text(to_ascii_digits(line["text"]))
        if not chapter and re.match(r"^\d+\.\s*", text):
            chapter = text
        if set_number is None:
            match = re.match(r"^(\d{1,2})$", text.replace("[", "").replace("]", "").replace("「", ""))
            if match:
                set_number = int(match.group(1))
        if exam_year is None or exam_round is None:
            match = re.search(r"第(\d+)回\((\d{4})年\)\s*第(\d+)[問間]", text)
            if match:
                exam_year = int(match.group(2))
                exam_round = int(match.group(3))
    return chapter, set_number, exam_year, exam_round


def collect_columns(lines: list[dict[str, Any]]) -> tuple[list[str], list[str], list[str]]:
    left: list[str] = []
    right_top: list[str] = []
    right_bottom: list[str] = []

    for line in lines:
        text = normalize_text(to_ascii_digits(line["text"]))
        max_y = line["maxY"]
        min_x = line["minX"]

        if min_x < 0.52:
            if 0.39 <= max_y <= 0.80:
                left.append(text)
        else:
            if max_y >= 0.62:
                right_top.append(text)
            elif 0.10 <= max_y <= 0.38:
                right_bottom.append(text)

    return left, right_top, right_bottom


def split_question_blocks(left_lines: list[str]) -> list[list[str]]:
    expanded: list[str] = []
    embedded_pattern = re.compile(r"(?<![.0-9])\s([2-4])(?=[^\.\d\s][^\s])")
    question_start_pattern = re.compile(r"^\d+(?:\s|(?=[^\.\d]))")

    for text in left_lines:
        cursor = text
        while True:
            match = embedded_pattern.search(cursor)
            if not match:
                expanded.append(cursor)
                break
            split_at = match.start(1)
            expanded.append(cursor[:split_at].strip())
            cursor = cursor[split_at:].strip()

    blocks: list[list[str]] = []
    current: list[str] = []

    for text in expanded:
        if not text:
            continue
        if question_start_pattern.match(text):
            if current:
                blocks.append(current)
            current = [text]
        elif current:
            current.append(text)

    if current:
        blocks.append(current)
    return blocks


def parse_options(option_text: str) -> list[str]:
    compact = normalize_text(option_text)
    compact = compact.replace("[語 群]", "[語群]").replace("[語群]", "")
    compact = re.sub(r"\s+", " ", compact)
    patterns = [
        r"1[\.．]?\s*(.*?)\s*2[\.．]?\s*(.*?)\s*3[\.．]?\s*(.*)",
        r"1[\.．]?\s*(.*?)\s*2[\.．]?\s*(.*)",
    ]

    for pattern in patterns:
        match = re.search(pattern, compact)
        if match:
            options = [segment.strip(" .") for segment in match.groups() if segment.strip(" .")]
            if options:
                return options

    parts = re.split(r"\s+[123][\.．]?\s*", " " + compact)
    options = [part.strip(" .") for part in parts if part.strip(" .")]
    return options


def parse_prompt(block_lines: list[str]) -> tuple[str, list[str]]:
    stem_lines: list[str] = []
    option_lines: list[str] = []
    option_mode = False

    for text in block_lines:
        if "[語群]" in text or "[語 群]" in text:
            option_mode = True
        if option_mode:
            option_lines.append(text)
        else:
            stem_lines.append(text)

    prompt = normalize_text(" ".join(stem_lines))
    options = parse_options(" ".join(option_lines))
    return prompt, options


def parse_answers(answer_lines: list[str]) -> dict[str, tuple[int | None, str]]:
    answers: dict[str, tuple[int | None, str]] = {}
    current_label = None
    explanation_lines: list[str] = []
    current_index = None

    def flush() -> None:
        nonlocal current_label, explanation_lines, current_index
        if current_label:
            answers[current_label] = (current_index, normalize_text(" ".join(explanation_lines)))
        current_label = None
        explanation_lines = []
        current_index = None

    for text in answer_lines:
        match = re.match(r"^([アイウエオカ])[-ー−]?\s*([1234])", text)
        if match:
            flush()
            current_label = match.group(1)
            current_index = int(match.group(2)) - 1
            remainder = text[match.end() :].strip(" .")
            if remainder:
                explanation_lines.append(remainder)
        elif current_label:
            explanation_lines.append(text)

    flush()
    return answers


def build_questions(pages: list[dict[str, Any]]) -> list[QuestionItem]:
    questions: list[QuestionItem] = []

    for page in pages:
        lines = page["lines"]
        if not is_question_page(lines):
            continue

        image_path = page["imagePath"]
        source_pdf = extract_source_pdf(image_path)
        volume = detect_volume(source_pdf)
        page_number = parse_page_number(image_path)
        chapter, set_number, exam_year, exam_round = parse_metadata(lines)
        left_lines, right_top, right_bottom = collect_columns(lines)
        blocks = split_question_blocks(left_lines)
        answers = parse_answers(right_bottom)
        keywords = normalize_text(" ".join(right_top))

        for index, block in enumerate(blocks):
            if index >= len(BLANK_LABELS):
                break
            blank_label = BLANK_LABELS[index]
            prompt, options = parse_prompt(block)
            if not prompt or not options:
                continue

            answer_index, explanation = answers.get(blank_label, (None, ""))
            if answer_index is None and explanation:
                for option_index, option in enumerate(options):
                    normalized_option = normalize_text(option)
                    if explanation.startswith(normalized_option):
                        answer_index = option_index
                        break
            answer_text = options[answer_index] if answer_index is not None and answer_index < len(options) else None

            questions.append(
                QuestionItem(
                    id=f"{volume}-{page_number}-{blank_label}",
                    volume=volume,
                    chapter=chapter,
                    set_number=set_number,
                    exam_year=exam_year,
                    exam_round=exam_round,
                    blank_label=blank_label,
                    prompt=prompt,
                    options=options,
                    answer_index=answer_index,
                    answer_text=answer_text,
                    explanation=explanation,
                    keywords=keywords,
                    source_pdf=source_pdf,
                    source_page=page_number,
                    image_path=image_path,
                )
            )

    return questions


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: build_questions.py <ocr-pages.json> <output.json>", file=sys.stderr)
        return 64

    input_path, output_path = sys.argv[1], sys.argv[2]
    pages = load_pages(input_path)
    questions = build_questions(pages)

    payload = {
        "generatedFrom": os.path.basename(input_path),
        "questionCount": len(questions),
        "questions": [asdict(question) for question in questions],
    }

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"wrote {len(questions)} questions to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
