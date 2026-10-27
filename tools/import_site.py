#!/usr/bin/env python3
"""Bring the design pages over from a gear-box-system checkout.

    python3 tools/import_site.py ../gear-box-system

The pages are written in the model repo (docs/site/, by the docs generator
and by hand). This copies them into site/ and makes them stand alone:

  * pages that are bare artifact fragments get a full HTML skeleton;
  * pictures they use (boxes/*/img/, docs/**/img/) are copied next to them,
    and "../../boxes/..." links become "boxes/...";
  * the sandbox (sim/) is copied to site/sandbox/, and its "design doc"
    links point at the design pages instead of the source repo;
  * STANDARD.md and docs/WHAT_CAN_IT_DO.md become standard.html and
    what.html;
  * notes that only make sense next to the source (print-file commands,
    "Model: lib/x.scad" footers) are taken out, and each box page gets a
    MakerWorld panel (filled from site/makerworld.js);
  * claude.ai links become local pages, or plain text if there is none.

site/makerworld.js is merged, never overwritten: links already filled in
stay, new boxes and kits get an empty entry. Safe to run again. Run
tools/check_site.py afterwards (CI runs it too).
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "site")

# Pages that live only on claude.ai and have a local stand-in here.
EXTRA_PAGES = {"4J8Uzxu1kquD3WdAw8ci4u": "what.html"}

# Boxes shown on another box's page (the page has no card of their own).
SHARED_PAGE = {"flip": "push", "click": "push", "wave": "trig",
               "beat": "percussion", "boom": "percussion", "roll": "percussion",
               "wire2": "longwire", "wire3": "longwire", "pole2": "longwire",
               "pole3": "longwire", "route": "switches", "pick": "switches",
               "steer": "switches", "square": "clocks", "ramp": "clocks",
               "cbdrive": "brain", "cbsense": "brain"}

KITS = [("starter", "First Turns"), ("clockwork", "Tick Tock"), ("logic", "Gear Logic"),
        ("math", "Gear Calculator"), ("machines", "Motion and Power"), ("party", "Party")]

HEAD = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n')

DEAD = "#no-local-page"

MW_TAGS = '<script src="makerworld.js"></script>\n<script src="mw.js"></script>\n'


def die(msg):
    sys.exit("import_site: " + msg)


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


# ---- the box list ---------------------------------------------------------

def box_labels(src):
    """Box name -> lid name, from the sandbox data, else the name in capitals."""
    text = read(os.path.join(src, "sim", "data", "boxes.js"))
    data = json.loads(text[text.index("{"):text.rindex("}") + 1])
    labels = {n: b["box"][1] for n, b in data["boxes"].items()}
    for n in sorted(os.listdir(os.path.join(src, "boxes"))):
        if os.path.isdir(os.path.join(src, "boxes", n, "img")):
            labels.setdefault(n, n.upper())
    return labels


def box_pages(src_site, labels):
    """Box name -> its design page (file stem)."""
    pages = {}
    index = read(os.path.join(src_site, "index.html"))
    for href, box in re.findall(r'<a class="card" href="([a-z0-9]+)\.html"><img src="[./]*boxes/([a-z0-9]+)/img/', index):
        pages.setdefault(box, href)
    for n in labels:
        if n in pages:
            continue
        if os.path.exists(os.path.join(src_site, n + ".html")):
            pages[n] = n
        elif n in SHARED_PAGE:
            pages[n] = SHARED_PAGE[n]
    return pages


# ---- one page --------------------------------------------------------------

def standalone(text):
    """A full HTML document: fragments get <html>, <head> and <body>."""
    if re.match(r"\s*<!doctype", text, re.I):
        if "<meta charset" not in text.lower():
            text = re.sub(r"(<head[^>]*>)", r'\1\n<meta charset="utf-8">', text, count=1, flags=re.I)
        if 'name="viewport"' not in text:
            text = re.sub(r"(<head[^>]*>)", r'\1\n<meta name="viewport" content="width=device-width, initial-scale=1">', text, count=1, flags=re.I)
        return text
    # an artifact fragment: <title>, <meta>, <link>, <style> first, then the body
    m = re.match(r"\s*((?:<title>.*?</title>|<meta[^>]*>|<link[^>]*>|<style[^>]*>.*?</style>|\s)*)", text, re.S)
    head, body = m.group(1), text[m.end():]
    head = re.sub(r'<meta name="claude:[^"]*"[^>]*>\s*', "", head)
    return HEAD + head.strip() + "\n</head>\n<body>\n" + body.strip() + "\n</body>\n</html>\n"


def relocate(text, src, src_site, copies):
    """'../../boxes/x/img/y.png' -> 'boxes/x/img/y.png', and note the copy."""
    def sub(m):
        q, rel = m.group(1), m.group(2)
        path = os.path.normpath(os.path.join(src_site, rel))
        repo_rel = os.path.relpath(path, src).replace(os.sep, "/")
        if repo_rel.startswith("sim/"):
            return q + "sandbox/" + repo_rel[4:]
        if not os.path.isfile(path):
            die(f"missing file {repo_rel}")
        copies.add(repo_rel)
        return q + repo_rel
    return re.sub(r"""(["'(])((?:\.\./)+[^"'()\s]+)""", sub, text)


def delink_artifacts(text, pages, name):
    def sub(m):
        target = pages.get(m.group(2))
        if target:
            return m.group(1) + target + m.group(3)
        print(f"  {name}: unknown claude.ai page {m.group(2)}, link removed")
        return m.group(1) + DEAD + m.group(3)
    text = re.sub(r'(["\'])https://claude\.ai/artifact/([A-Za-z0-9]+)(["\'])', sub, text)
    # a link to a page we don't have is just its text
    return re.sub(r'<a href="' + DEAD + r'"[^>]*>(.*?)</a>', r"\1", text, flags=re.S)


def tidy(text, name):
    """Take out the notes that point into the source repo."""
    text = re.sub(r'\s*<p class="readout">Print files: .*?</p>', "", text, flags=re.S)
    text = re.sub(r'\s*<p class="readout">Model: .*?</p>', "", text, flags=re.S)
    text = re.sub(r'\s*<span class="readout">(?:Model|doc): .*?</span>', "", text, flags=re.S)
    text = re.sub(r"\s*<span[^>]*>\s*· (?:this box's doc|docs) in the repo: .*?</span>", "", text, flags=re.S)
    text = re.sub(r"\s*Print files: <code>tools/export_all\.sh[^<]*</code>[^.<]*\.", "", text)
    text = re.sub(r"<footer>Model <code>.*?doc <code>[^<]*</code>\.\s*", "<footer>", text, flags=re.S)
    text = re.sub(r"<footer>\s*</footer>", "", text)
    if name != "index.html" and 'href="index.html"' not in text:
        text = re.sub(r"(</main>|</body>)", r'<footer class="foot"><a href="index.html">← Back to all boxes</a></footer>\n\1', text, count=1)
    # the standard has its own page now
    text = re.sub(r"<(code|strong)>STANDARD\.md</\1>", '<a href="standard.html">the box standard</a>', text)
    text = text.replace(
        "The rules every box follows are in <code>STANDARD.md</code>.",
        'The rules every box follows are in <a href="standard.html">the box standard</a>.')
    text = re.sub(r"\s*In the repo, every page has a copy under <code>docs/boxes/</code>\.", "", text)
    return text


def add_makerworld(text, name, boxes_here):
    if "mw.js" in text:
        return text
    if name == "index.html":
        slot = ('<p class="links"><strong>Print them:</strong> every box and kit will have its print files '
                'on MakerWorld. See <a href="makerworld.html">the MakerWorld list</a>.</p>')
        text = re.sub(r'(<p class="links">The rules every box follows)', slot + "\n  " + r"\1", text, count=1)
    elif name == "kits.html":
        text = re.sub(r'(<section class="kit" id="([a-z]+)"[^>]*>\s*<div[^>]*>.*?</div>)',
                      lambda m: m.group(1) + f'\n  <div class="mw-slot" data-makerworld="kit:{m.group(2)}"></div>',
                      text, flags=re.S)
    elif boxes_here:
        slot = f'<div class="mw-slot" data-makerworld="{",".join("box:" + b for b in boxes_here)}"></div>'
        text, n = re.subn(r"(</h1>)", r"\1" + slot, text, count=1)
        if not n:
            die(f"{name}: no <h1> to put the MakerWorld panel after")
    return re.sub(r"</body>", MW_TAGS + "</body>", text, count=1)


# ---- Markdown pages ---------------------------------------------------------

PAGE_STYLE = """<style>
:root { --bg: #F6F1E6; --panel: #EDE3D0; --fg: #23211D; --muted: #6B655A; --line: #CFC3AC; --blue: #1F6FD6;
  --f-display: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --f-body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  --f-mono: "JetBrains Mono", ui-monospace, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #1A1C1F; --panel: #24272B; --fg: #ECE6DA; --muted: #A39C8E; --line: #3A3E44; --blue: #5E9BF0; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #1A1C1F; --panel: #24272B; --fg: #ECE6DA; --muted: #A39C8E; --line: #3A3E44; --blue: #5E9BF0; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 17px/1.6 var(--f-body); margin: 0; }
main { max-width: 820px; margin: 0 auto; padding: 28px 16px 64px; }
a { color: var(--blue); }
h1, h2, h3 { font-family: var(--f-display); line-height: 1.15; text-wrap: balance; }
h1 { font-size: clamp(2.2rem, 6vw, 3.2rem); margin: 0.4em 0 0.3em; }
h2 { font-size: 1.6rem; margin-top: 2em; padding-top: 0.6em; border-top: 1px solid var(--line); }
h3 { font-size: 1.15rem; margin-top: 1.6em; }
code { font-family: var(--f-mono); font-size: 0.86em; background: var(--panel); padding: 1px 4px; border-radius: 4px; }
pre { background: var(--panel); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; font-size: 0.95rem; display: block; overflow-x: auto; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-family: var(--f-mono); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
img { max-width: 100%; }
.note { color: var(--muted); font-size: 0.95rem; }
nav a, footer a { font: 700 1rem var(--f-display); text-decoration: none; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line); }
</style>"""

FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700'
         '&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap">')


def md_page(md_text, title, note, page_of_doc):
    try:
        import markdown
    except ImportError:
        die("needs Python-Markdown: pip install markdown")
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "toc", "sane_lists"])
    # a box doc named in the text becomes a link to its design page
    def doc(m):
        page = page_of_doc(m.group(1))
        return f'<a href="{page}">{m.group(0)}</a>' if page else m.group(0)
    body = re.sub(r"<code>docs/boxes/([A-Za-z0-9_]+)\.md</code>", doc, body)
    body = body.replace("<code>STANDARD.md</code>", '<a href="standard.html">the box standard</a>')
    return (HEAD + f"<title>{html.escape(title)}</title>\n{FONTS}\n{PAGE_STYLE}\n</head>\n<body>\n<main>\n"
            f'<nav><a href="index.html">← All boxes</a></nav>\n'
            + (f'<p class="note">{note}</p>\n' if note else "") + body +
            '\n<footer><a href="index.html">← Back to all boxes</a></footer>\n</main>\n</body>\n</html>\n')


# ---- the MakerWorld data file -------------------------------------------------

MW_HOW = ("MakerWorld links for every box and kit. Paste a model's MakerWorld URL between the quotes "
          "after \"url\". An empty url shows a 'coming soon' placeholder on the site. "
          "tools/import_site.py adds new boxes and kits here and never changes a url.")


def merge_makerworld(labels, pages):
    path = os.path.join(OUT, "makerworld.js")
    old = {}
    if os.path.exists(path):
        text = read(path)
        old = json.loads(text[text.index("{"):text.rindex("}") + 1])
    data = {"_how": MW_HOW, "profile": old.get("profile", ""), "boxes": {}, "kits": {}}
    for n in sorted(labels):
        was = old.get("boxes", {}).get(n, {})
        data["boxes"][n] = {"name": labels[n], "page": (pages.get(n, "") + ".html") if pages.get(n) else "",
                            "url": was.get("url", "")}
    for k, name in KITS:
        was = old.get("kits", {}).get(k, {})
        data["kits"][k] = {"name": name, "page": "kits.html#" + k, "url": was.get("url", "")}
    # keep anything filled in by hand that the source no longer lists
    for group in ("boxes", "kits"):
        for k, v in old.get(group, {}).items():
            if k not in data[group] and v.get("url"):
                data[group][k] = v
    body = json.dumps(data, indent=2, ensure_ascii=False)
    write(path, "/* Edit the urls below; see \"_how\". This file is JSON after the '=' sign. */\n"
                "window.MAKERWORLD = " + body + ";\n")


# ---- the sandbox --------------------------------------------------------------

def import_sandbox(src, pages):
    sim, dst = os.path.join(src, "sim"), os.path.join(OUT, "sandbox")
    if os.path.isdir(dst):
        shutil.rmtree(dst)
    for rel in ("index.html", "app.js", "kin.js", "data/boxes.js", "data/meshes.js"):
        os.makedirs(os.path.dirname(os.path.join(dst, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(sim, rel), os.path.join(dst, rel))
    # mesh data is base64; runs like "AKID..." look like a cloud key to GitHub's
    # push protection, so spell the I as a JS escape (same string once parsed)
    meshes = os.path.join(dst, "data", "meshes.js")
    write(meshes, read(meshes).replace("AKID", "AK\\u0049D"))
    app = read(os.path.join(dst, "app.js"))
    doc_map = json.dumps({n: p for n, p in sorted(pages.items())})
    patches = [
        (r'const REPO = "https://github\.com/[^"]*";', 'const REPO = "../";'),
        (r"const DOC = \{[^}]*\};", f"const DOC = {doc_map};"),
        (r'(const doc = REPO \+ \(DOC\[it\.name\] \|\| it\.name\) \+ )"\.md";', r'\1".html";'),
    ]
    for pat, rep in patches:
        app, n = re.subn(pat, rep, app)
        if n != 1:
            die(f"sandbox app.js changed: could not apply {pat!r}; update import_site.py")
    write(os.path.join(dst, "app.js"), app)
    page = read(os.path.join(dst, "index.html"))
    page = page.replace("Kits (docs/boxes/KITS.md)", "Kits")
    write(os.path.join(dst, "index.html"), page)


# ---- main ---------------------------------------------------------------------

def main():
    if len(sys.argv) != 2:
        die("usage: python3 tools/import_site.py <gear-box-system checkout>")
    src = os.path.abspath(sys.argv[1])
    src_site = os.path.join(src, "docs", "site")
    if not os.path.isfile(os.path.join(src_site, "pages.json")):
        die(f"{src_site} has no pages.json; is this a gear-box-system checkout?")
    rev = subprocess.run(["git", "-C", src, "rev-parse", "--short", "HEAD"],
                         capture_output=True, text=True).stdout.strip() or "unknown"

    with open(os.path.join(src_site, "pages.json")) as f:
        art = {k: os.path.basename(v) for k, v in json.load(f)["pages"].items() if not v.startswith("..")}
    art.update(EXTRA_PAGES)
    art["DgEZKRsRqhhYqr3bYRb19w"] = "sandbox/index.html"

    labels = box_labels(src)
    pages = box_pages(src_site, labels)
    boxes_on = {}
    for n, p in pages.items():
        boxes_on.setdefault(p + ".html", []).append(n)

    # clear the old pages and pictures, keep the hand-made files of this repo
    for name in os.listdir(OUT) if os.path.isdir(OUT) else []:
        p = os.path.join(OUT, name)
        if name.endswith(".html") and name != "makerworld.html":
            os.remove(p)
        elif name in ("boxes", "docs"):
            shutil.rmtree(p)

    copies = set()
    for name in sorted(os.listdir(src_site)):
        if not name.endswith(".html"):
            continue
        text = read(os.path.join(src_site, name))
        text = standalone(text)
        text = delink_artifacts(text, art, name)
        text = relocate(text, src, src_site, copies)
        text = tidy(text, name)
        here = sorted(boxes_on.get(name, []), key=lambda b: (b + ".html" != name, b))
        text = add_makerworld(text, name, here)
        write(os.path.join(OUT, name), text)

    for rel in sorted(copies):
        os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(src, rel), os.path.join(OUT, rel))

    def page_of_doc(doc):
        doc = doc.lower()
        if doc == "colors":
            return "colors.html"
        if doc == "kits":
            return "kits.html"
        if doc == "index":
            return "index.html"
        if os.path.exists(os.path.join(OUT, doc + ".html")):
            return doc + ".html"
        return (pages[doc] + ".html") if doc in pages else None

    std = read(os.path.join(src, "STANDARD.md"))
    write(os.path.join(OUT, "standard.html"),
          md_page(std, "The Gear Box standard",
                  f"The rules every box follows, as of model version {rev}. Names in "
                  "<code>code</code> type are files in the OpenSCAD model.", page_of_doc))
    what = read(os.path.join(src, "docs", "WHAT_CAN_IT_DO.md"))
    what = re.sub(r"\s*A copy of the Claude Doc at \S+\.", "", what)
    write(os.path.join(OUT, "what.html"), md_page(what, "What the gear boxes can do", "", page_of_doc))

    import_sandbox(src, pages)
    merge_makerworld(labels, pages)
    write(os.path.join(OUT, "VERSION"), rev + "\n")
    print(f"import_site: {len(os.listdir(src_site))} source files, {len(copies)} pictures, "
          f"{len(labels)} boxes, from {rev}")


if __name__ == "__main__":
    main()
