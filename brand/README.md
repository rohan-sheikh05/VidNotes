# VidNotes logo

**Idea: "Intervals".** The mark is three note lines that get longer the way review intervals do. The last line ends in a playhead, so it reads as a video timeline. Notes, growing memory and video, in one glance.

The mark is ours. It uses no YouTube logos, marks or names.

## Files (`brand/logo/`)

| File | Use |
|---|---|
| `vidnotes-horizontal.svg` / `-dark.svg` | Primary lockup, for headers and documents. Use `-dark` on dark backgrounds. |
| `vidnotes-stacked.svg` / `-dark.svg` | For square or narrow spaces such as splash screens and profile cards. |
| `vidnotes-symbol.svg` / `-dark.svg` | Symbol alone, above 32px. |
| `vidnotes-symbol-small.svg` / `-dark.svg` | **Small-size cut, for 32px and below.** It has heavier lines and a wider gap around the knob. |
| `export/*-black.svg`, `*-white.svg`, `*-mono-cc0000.svg` | One-colour versions, for print, embossing and single-colour use. |
| `export/` PNGs, `favicon.ico`, `icon-*.png`, `maskable-512.png` | Web and PWA icon set. Copies are in `public/`. |

To rebuild the masters, run `python brand/build_logo.py`. It needs `shapely` and `fonttools` with `brotli`. Then re-run the logo-design skill's `export_variants.py` (see the bottom of this file).

## Colour

| | Light background | Dark background |
|---|---|---|
| Ink: the two note lines and the wordmark | `#0F0F0F` · RGB 15 15 15 | `#F1F1F1` |
| Red: the watched bar, the playhead and the dot on the i | `#CC0000` · RGB 204 0 0 · CMYK ≈ 0 100 100 20 | `#FF4E45` |

For print, the nearest spot colour to `#CC0000` is around Pantone 485 C. This is an estimate, so check it against a physical swatch with your printer. The one-colour versions must stay legible, and they do: the idea lives in the shapes, not the colours.

## Clear space and minimum size

- **Clear space:** keep at least **one dot** of empty space on every side. "One dot" is the diameter of the top note line.
- **Minimum size:**
  - The horizontal lockup must be at least 20px tall (7mm in print).
  - Below 32px, use the `-small` symbol.
  - The symbol works down to 16px.

## Wordmark

The wordmark is Roboto Bold, licensed Apache-2.0, which allows logo use. It is converted to outlines and set slightly tight. The dot of the **i** is a true circle in brand red, echoing the playhead. Never retype the wordmark in a live font; use the files.

## Don't

- Recolour the note lines red, or the playhead black, in the colour version.
- Remove the gap between the bar and the playhead.
- Rotate, skew, outline, or add shadows or gradients.
- Put the mark inside a red rounded rectangle, or pair it with a play-triangle badge. That reads as YouTube.
- Use the regular symbol below 32px. Use the small cut.

## Exports

```bash
S=~/.claude/skills/logo-design/scripts
python $S/export_variants.py brand/logo/vidnotes-symbol.svg --out-dir brand/logo/export --title "VidNotes logo" \
  --mono "#CC0000" --icon-bg "#FFFFFF" --icon-fg keep --icon-scale 0.62 \
  --favicon-source brand/logo/vidnotes-symbol-small.svg --web-icons
python $S/export_variants.py brand/logo/vidnotes-horizontal.svg --out-dir brand/logo/export --title "VidNotes logo" \
  --only black white mono --mono "#CC0000" --png 1200
```

`public/favicon.svg` is written by hand from the small cut. It switches its colours with `prefers-color-scheme`, so it stays visible on dark browser tabs. Rebuild it if the small cut changes.

## Notes

- **Trademark:** no clearance search has been done. Run a professional search before registering the mark.
- **Earlier concepts:** the explored directions and iterations are in `brand/concepts/`.
