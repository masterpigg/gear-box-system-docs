#!/usr/bin/env python3
"""Keep the project in US spelling (color, center, gray, ...).

    python3 tools/us_spelling.py            # list British spellings, exit 1 if any
    python3 tools/us_spelling.py --fix      # rewrite them in place and rename files
    python3 tools/us_spelling.py --fix DIR  # same, for another folder

Text inside URLs is left alone (artifact ids are random letters), and so are
BOSL2, .git, binary files and the generated meshes. Case is kept: Colour ->
Color, COLOUR -> COLOR. Identifiers change too (gbs_lid_colour ->
gbs_lid_color), so run --fix over the whole repo at once.
"""
import os
import re
import sys

# Order matters: longer forms first.
RULES = [
    (r"centr(ed|ing)", r"center\1"),
    (r"centre", "center"),
    (r"colour", "color"),
    (r"grey", "gray"),
    (r"neighbour", "neighbor"),
    (r"favour", "favor"),
    (r"behaviour", "behavior"),
    (r"armour", "armor"),
    (r"honour", "honor"),
    (r"labour", "labor"),
    (r"harbour", "harbor"),
    (r"odour", "odor"),
    (r"rumour", "rumor"),
    (r"flavour", "flavor"),
    (r"vigour", "vigor"),
    (r"metre", "meter"),
    (r"fibre", "fiber"),
    (r"calibre", "caliber"),
    (r"aluminium", "aluminum"),
    (r"artefact", "artifact"),
    (r"\bmould", "mold"),
    (r"\btyre(s?)\b", r"tire\1"),
    (r"\blicence", "license"),
    (r"\bcatalogue", "catalog"),
    (r"\banalys(e|ed|ing)\b", r"analyz\1"),
    (r"(organi|reali|recogni|optimi|minimi|maximi|synchroni|customi|summari"
     r"|prioriti|visuali|normali|initiali|standardi|finali|utili)s(e|ed|es|ing|ation)",
     r"\1z\2"),
    (r"(model|label|travel|cancel|level|signal|dial|fuel)l(ed|ing)", r"\1\2"),
]
RULES = [(re.compile(p, re.I), r) for p, r in RULES]
# Left alone: URLs, embedded pictures, and HTML's own aria-labelledby attribute.
URL = re.compile(r"https?://\S+|data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+|aria-labelledby")
SKIP_DIRS = {".git", "BOSL2", "node_modules", "exports", "scratch", "build"}   # (scratch and sim/build are gitignored)
SKIP_FILES = {"meshes.js", "us_spelling.py"}
TEXT_EXT = {".md", ".scad", ".sh", ".py", ".js", ".html", ".css", ".json",
            ".txt", ".csv", ".yml", ".yaml", ".toml", ""}


def keep_case(src, dst):
    if src.isupper():
        return dst.upper()
    if src[:1].isupper():
        return dst[:1].upper() + dst[1:]
    return dst


def fix_plain(text):
    for pat, rep in RULES:
        text = pat.sub(lambda m: keep_case(m.group(0), m.expand(rep)), text)
    return text


def fix(text):
    out, last = [], 0
    for m in URL.finditer(text):
        out.append(fix_plain(text[last:m.start()]))
        out.append(m.group(0))
        last = m.end()
    out.append(fix_plain(text[last:]))
    return "".join(out)


def walk(root):
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            yield d, f
        for x in dirs:
            yield d, x + "/"


def main():
    args = sys.argv[1:]
    do_fix = "--fix" in args
    args = [a for a in args if a != "--fix"]
    root = args[0] if args else os.path.join(os.path.dirname(__file__), "..")
    hits, renames = 0, []
    for d, name in walk(root):
        path = os.path.join(d, name.rstrip("/"))
        new = fix_plain(name.rstrip("/"))
        if new != name.rstrip("/"):
            renames.append((path, os.path.join(d, new)))
        if name.endswith("/") or name in SKIP_FILES or re.fullmatch(r"meshes\d*\.js", name):
            continue
        if os.path.splitext(name)[1].lower() not in TEXT_EXT:
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except (UnicodeDecodeError, OSError):
            continue
        new_text = fix(text)
        if new_text == text:
            continue
        for i, (a, b) in enumerate(zip(text.splitlines(), new_text.splitlines()), 1):
            if a != b:
                hits += 1
                if not do_fix:
                    print(f"{path}:{i}: {a.strip()[:100]}")
        if do_fix:
            with open(path, "w", encoding="utf-8", newline="") as fh:
                fh.write(new_text)
    # Rename deepest paths first so parent folders move last.
    for old, new in sorted(renames, key=lambda p: -p[0].count(os.sep)):
        print(f"rename {old} -> {new}")
        if do_fix:
            os.rename(old, new)
    if not do_fix:
        print(f"{hits} lines, {len(renames)} names to fix")
        sys.exit(1 if hits or renames else 0)
    print(f"fixed {hits} lines, renamed {len(renames)}")


if __name__ == "__main__":
    main()
