# Pixel Art Save Format

Files are saved as `.json` into the `saves/` folder.

## File Structure (v2 — animated)

```json
{
  "version": 2,
  "name": "aria_idle",
  "width": 16,
  "height": 16,
  "frameCount": 4,
  "fps": 8,
  "looping": true,
  "frames": [
    { "3,2": "#ff6688", "4,2": "#ff6688", "3,3": "#ff6688" },
    { "3,2": "#ff6688", "4,2": "#ff6688", "3,4": "#ff6688" }
  ],
  "savedAt": "2026-03-07T12:00:00.000Z"
}
```

## Pixel Key Format

Each frame is a plain object.
Keys are `"x,y"` where:
- `x` = column, 0-indexed from the **left**
- `y` = row,    0-indexed from the **top**

So `"0,0"` is the top-left pixel, `"15,15"` is the bottom-right of a 16×16 grid.

Values are hex color strings (`#rrggbb`).
**Missing keys = transparent / empty.**

## Reading a File (for Claude)

To understand what was drawn in a frame, read the `pixels` keys:
- Group by `y` to see each row
- Group by `x` to see each column
- Cluster adjacent same-colored pixels to identify shapes

### Example: a simple 3×3 filled square at (2,2)
```json
{
  "2,2": "#ffffff", "3,2": "#ffffff", "4,2": "#ffffff",
  "2,3": "#ffffff", "3,3": "#ffffff", "4,3": "#ffffff",
  "2,4": "#ffffff", "3,4": "#ffffff", "4,4": "#ffffff"
}
```

## Single-frame files (v1 legacy)

Older saves may have a flat `"pixels"` key instead of `"frames"` array.
The editor handles both when loading.

## Where to save

By convention, save files here:
```
tools/pixel-art-editor/saves/<name>.json
```
