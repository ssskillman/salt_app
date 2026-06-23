#!/usr/bin/env python3
"""
check_sigma_config_keys.py

Compare the saved Sigma iframe `config` query param against the current
src/app/editorConfig.js names.

Designed for long Sigma plugin URLs:
  - Read URL from a file
  - Read URL from macOS clipboard with --clipboard
  - Read URL from stdin pipe
  - Prompt as fallback

Examples:
  pbpaste | python3 scripts/check_sigma_config_keys.py

  python3 scripts/check_sigma_config_keys.py --clipboard

  python3 scripts/check_sigma_config_keys.py --file /tmp/sigma_url.txt

  python3 scripts/check_sigma_config_keys.py \
    --editor-config src/app/editorConfig.js \
    --file /tmp/sigma_url.txt
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


DEFAULT_EDITOR_CONFIG = "src/app/editorConfig.js"


def read_text_from_args(args: argparse.Namespace) -> str:
    if args.file:
        return Path(args.file).read_text().strip()

    if args.clipboard:
        completed = subprocess.run(
            ["pbpaste"],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr.strip() or "pbpaste failed")
        return completed.stdout.strip()

    if not sys.stdin.isatty():
        return sys.stdin.read().strip()

    print("Paste Sigma iframe URL, then press Ctrl-D when done:")
    return sys.stdin.read().strip()


def extract_url(raw_text: str) -> str:
    raw_text = raw_text.strip()

    if not raw_text:
        raise ValueError("No input provided.")

    # If the user pasted extra logs/text, pull the first URL-looking token.
    match = re.search(r"https?://[^\s\"'<>]+", raw_text)
    if match:
        return match.group(0)

    return raw_text


def load_config_from_url(url: str) -> tuple[dict, str]:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)

    if "config" not in qs:
        available = ", ".join(sorted(qs.keys())) or "(none)"
        raise ValueError(f"No `config` query param found. Available params: {available}")

    config_raw = qs["config"][0]
    config_decoded = unquote(config_raw)

    try:
        config = json.loads(config_decoded)
    except json.JSONDecodeError as exc:
        raise ValueError(f"`config` query param could not be parsed as JSON: {exc}") from exc

    if not isinstance(config, dict):
        raise ValueError(f"`config` parsed as {type(config).__name__}, expected object/dict.")

    return config, config_decoded


def load_editor_names(editor_config_path: Path) -> set[str]:
    text = editor_config_path.read_text()

    # Supports object fields like:
    # { name: "source_detail", ... }
    # { name: 'source_detail', ... }
    return set(re.findall(r'name:\s*["\']([^"\']+)["\']', text))


def print_section(title: str, values: list[str], max_items: int | None = None) -> None:
    print(f"\n=== {title} ===")

    if not values:
        print("(none)")
        return

    shown = values if max_items is None else values[:max_items]

    for value in shown:
        print(value)

    if max_items is not None and len(values) > max_items:
        print(f"... plus {len(values) - max_items:,} more")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Find stale Sigma config keys compared with current editorConfig.js."
    )

    parser.add_argument(
        "--file",
        help="Path to a file containing the full Sigma iframe URL.",
    )
    parser.add_argument(
        "--clipboard",
        action="store_true",
        help="Read the full Sigma iframe URL from macOS clipboard using pbpaste.",
    )
    parser.add_argument(
        "--editor-config",
        default=DEFAULT_EDITOR_CONFIG,
        help=f"Path to editorConfig.js. Default: {DEFAULT_EDITOR_CONFIG}",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=300,
        help="Maximum items to print per section. Use 0 for no limit.",
    )
    parser.add_argument(
        "--json-out",
        help="Optional path to write a JSON report.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    editor_config_path = Path(args.editor_config)

    if not editor_config_path.exists():
        parser.error(f"Editor config file not found: {editor_config_path}")

    try:
        raw_text = read_text_from_args(args)
        url = extract_url(raw_text)
        config, config_decoded = load_config_from_url(url)
        editor_names = load_editor_names(editor_config_path)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    config_keys = set(config.keys())

    stale = sorted(config_keys - editor_names)
    missing = sorted(editor_names - config_keys)
    shared = sorted(config_keys & editor_names)

    null_keys = sorted(key for key, value in config.items() if value is None)
    populated_keys = sorted(key for key, value in config.items() if value is not None)

    max_items = None if args.max_items == 0 else args.max_items

    print("\n=== Sigma config check ===")
    print("Full URL was read successfully. Full URL will not be printed.")
    print(f"URL length: {len(url):,}")
    print(f"Decoded config length: {len(config_decoded):,}")
    print(f"Config keys: {len(config_keys):,}")
    print(f"EditorConfig names: {len(editor_names):,}")
    print(f"Shared keys: {len(shared):,}")
    print(f"Stale keys in Sigma but not editorConfig: {len(stale):,}")
    print(f"EditorConfig names missing from Sigma config: {len(missing):,}")
    print(f"Null config keys: {len(null_keys):,}")
    print(f"Populated config keys: {len(populated_keys):,}")

    print_section("Stale keys in Sigma config but NOT in current editorConfig.js", stale, max_items)
    print_section("Current editorConfig names NOT present in Sigma config", missing, max_items)
    print_section("Null config keys currently taking URL space", null_keys, max_items)

    if stale:
        estimated_stale_chars = sum(
            len(json.dumps(key)) + len(json.dumps(config[key])) + 2
            for key in stale
        )
        print("\n=== Rough cleanup estimate ===")
        print(
            "Approx chars used by stale key/value pairs before URL encoding: "
            f"{estimated_stale_chars:,}"
        )
        print(
            "Best next move: delete/re-add the Sigma plugin instance or force a clean "
            "plugin config so Sigma stops sending stale keys."
        )
    else:
        print("\nNo stale keys found. Next optimization should be reducing current mappings.")

    if args.json_out:
        report = {
            "url_length": len(url),
            "decoded_config_length": len(config_decoded),
            "config_key_count": len(config_keys),
            "editor_config_name_count": len(editor_names),
            "shared_key_count": len(shared),
            "stale_key_count": len(stale),
            "missing_key_count": len(missing),
            "null_key_count": len(null_keys),
            "populated_key_count": len(populated_keys),
            "stale_keys": stale,
            "missing_keys": missing,
            "null_keys": null_keys,
        }
        Path(args.json_out).write_text(json.dumps(report, indent=2))
        print(f"\nJSON report written to: {args.json_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
