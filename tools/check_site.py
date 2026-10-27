#!/usr/bin/env python3
"""Check that site/ stands alone before it is published.

    python3 tools/check_site.py

Fails (exit 1) when:
  * any file links to claude.ai or to the model's source repo
    (github.com/masterpigg/gear-box-system, which is private);
  * a page links to, or loads, a local file that isn't there;
  * a MakerWorld entry names a page that isn't there, or its url isn't a
    MakerWorld link.
"""
import html
import json
import os
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
BANNED = [
    (re.compile(r"claude\.ai", re.I), "a claude.ai link"),
    (re.compile(r"github\.com/masterpigg/gear-box-system(?!-docs)", re.I), "a link to the private source repo"),
]
REF = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", re.I)
TEXT = (".html", ".js", ".css", ".json", ".md", ".txt", ".svg")


def main():
    errors = []
    for dirpath, _, files in os.walk(ROOT):
        for name in files:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            if not name.endswith(TEXT):
                continue
            with open(path, encoding="utf-8", errors="replace") as f:
                text = f.read()
            for pat, what in BANNED:
                for m in pat.finditer(text):
                    line = text.count("\n", 0, m.start()) + 1
                    errors.append(f"{rel}:{line}: {what}")
            if not name.endswith(".html"):
                continue
            for m in REF.finditer(text):
                url = html.unescape(m.group(1)).strip()
                if re.match(r"(?:[a-z][a-z0-9+.-]*:|//|#|\$\{)", url, re.I) or "${" in url or "+" in url:
                    continue
                target = unquote(urlsplit(url).path)
                if not target:
                    continue
                full = os.path.normpath(os.path.join(dirpath, target))
                if not full.startswith(ROOT) or not os.path.exists(full):
                    line = text.count("\n", 0, m.start()) + 1
                    errors.append(f"{rel}:{line}: broken local link {url}")

    mw = os.path.join(ROOT, "makerworld.js")
    with open(mw, encoding="utf-8") as f:
        text = f.read()
    try:
        data = json.loads(text[text.index("{"):text.rindex("}") + 1])
    except ValueError as e:
        errors.append(f"makerworld.js: not valid JSON after the '=' sign ({e})")
        data = {}
    for group in ("boxes", "kits"):
        for key, e in data.get(group, {}).items():
            page = (e.get("page") or "").split("#")[0]
            if page and not os.path.exists(os.path.join(ROOT, page)):
                errors.append(f"makerworld.js: {group}.{key} page {page} is missing")
            url = e.get("url", "")
            if url and not url.startswith("https://makerworld.com/"):
                errors.append(f"makerworld.js: {group}.{key} url is not a MakerWorld link: {url}")
    prof = data.get("profile", "")
    if prof and not prof.startswith("https://makerworld.com/"):
        errors.append(f"makerworld.js: profile is not a MakerWorld link: {prof}")

    for e in errors:
        print(e)
    boxes = len(data.get("boxes", {}))
    filled = sum(1 for g in ("boxes", "kits") for e in data.get(g, {}).values() if e.get("url"))
    print(f"check_site: {len(errors)} problem(s); {boxes} boxes, {len(data.get('kits', {}))} kits, "
          f"{filled} MakerWorld links filled in")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
