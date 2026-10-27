# Gear Box System docs site

Public site for the Gear Box System, published to GitHub Pages by
`.github/workflows/pages.yml`. The model and its source are in a separate,
private repo: never link to it, and never link to claude.ai.

- Imported pages (`site/*.html` except `makerworld.html`, `site/boxes/`,
  `site/docs/`, `site/sandbox/`) come from the model repo via
  `tools/import_site.py`; change them there, then re-import.
- `site/makerworld.js` holds every MakerWorld link (one file). The import
  merges new boxes in and never changes a url.
- Run `python3 tools/check_site.py` and `python3 tools/us_spelling.py site`
  before a commit. US spelling everywhere.
