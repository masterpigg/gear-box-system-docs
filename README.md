# Gear Box System: design pages

The lessons behind the Gear Box System: 3D-printed gear boxes that join on a
64 mm grid and pass motion from box to box. Each page explains one box: what
it does, how it works inside, what it teaches and how to build it. There is
also the box standard, the kits, the family colors and a browser sandbox where
you can lay boxes out and watch them turn.

**Read it online** on this repo's GitHub Pages site, or open `site/index.html`
in a browser (double-click it; nothing to install).

## Print files: MakerWorld links

Every box and kit gets a MakerWorld link. They all live in one file,
[`site/makerworld.js`](site/makerworld.js). To add one, paste the model's URL
between the quotes after `"url"`:

```js
"crank": { "name": "CRANK", "page": "crank.html", "url": "https://makerworld.com/en/models/..." },
```

An empty `"url"` shows a "coming soon" placeholder. `"profile"` at the top is
for the designer profile. The file is JSON after the `=` sign, so keep the
quotes and commas. The check below catches a typo before it is published.

## Layout

| Path | What |
|---|---|
| `site/` | The published site. `index.html` is the front page. |
| `site/makerworld.js` | The MakerWorld links (the only file to edit by hand for links). |
| `site/mw.js`, `site/makerworld.html` | Draw the MakerWorld panels and the full list. |
| `site/sandbox/` | The browser sandbox. It loads three.js from a CDN, so it needs the internet. |
| `tools/import_site.py` | Brings the pages over from the model repo (see below). |
| `tools/check_site.py` | Fails on a claude.ai link, a link to the model's source repo, a broken local link or a bad MakerWorld url. |
| `tools/us_spelling.py` | US spelling check (color, center, gray). |
| `.github/workflows/pages.yml` | Runs both checks and publishes `site/` to GitHub Pages on every push to `main`. |

## Updating the pages

The pages are written next to the OpenSCAD model (its `docs/site/` folder),
by the docs generator and by hand. Once a change is on the model's `main`:

```sh
pip install markdown
python3 tools/import_site.py ../gear-box-system   # path to a model checkout
python3 tools/check_site.py
python3 tools/us_spelling.py site
git add -A && git commit -m "Pages from model <rev>" && git push
```

The import rewrites the pages so they stand alone: fragments get a full HTML
skeleton, pictures are copied in, `STANDARD.md` and `WHAT_CAN_IT_DO.md` become
`standard.html` and `what.html`, notes that point into the source are taken
out, and every box page gets its MakerWorld panel. It never touches a filled-in
MakerWorld url. `site/VERSION` records the model revision it came from.

Don't edit the imported pages here; the next import replaces them. Change them
in the model repo, then import. The files this repo owns are
`site/makerworld.js`, `site/makerworld.html`, `site/mw.js`, `tools/` and this
README.

## Rules

- The site stands alone: no links to claude.ai and none to the model's source
  repo. `check_site.py` enforces it.
- US spelling throughout.
