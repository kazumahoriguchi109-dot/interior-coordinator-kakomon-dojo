#!/usr/bin/env python3

import json
import os
import subprocess
import sys
from pathlib import Path


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: run_ocr_batches.py <output.json> <image-path> [<image-path> ...]", file=sys.stderr)
        return 64

    output_path = Path(sys.argv[1])
    image_paths = [str(Path(path)) for path in sys.argv[2:]]
    script_path = Path(__file__).with_name("ocr_batch.swift")

    env = os.environ.copy()
    env.setdefault(
        "SWIFT_MODULECACHE_PATH",
        str(Path.cwd() / "tmp" / "swift-module-cache"),
    )
    env.setdefault(
        "CLANG_MODULE_CACHE_PATH",
        str(Path.cwd() / "tmp" / "clang-module-cache"),
    )

    pages = []
    total = len(image_paths)
    for batch_index, batch in enumerate(chunked(image_paths, 12), start=1):
        print(f"ocr batch {batch_index}: {len(batch)} pages", file=sys.stderr)
        command = ["swift", str(script_path), *batch]
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=env,
        )
        pages.extend(json.loads(result.stdout))
        print(f"processed {min(batch_index * 12, total)}/{total}", file=sys.stderr)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(pages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(pages)} OCR pages to {output_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
