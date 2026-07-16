---
name: verify
description: Build/launch/drive recipe for this static site (index.html + globe.js + app.js). No build step, no test suite — verification means driving the actual page in a browser.
---

## Environment notes
- `git` is **not usable** here (no Xcode command line tools — `git status`/`git diff`/`git log` all fail with an xcode-select error even though `.git/` exists). Don't waste time on git commands; diff by reading files directly or by recalling recent edits.

## Launch
```bash
cd "/Users/yejikim/Desktop/exchange coding" && python3 -m http.server <port>
```
Run in background, then hit it with a headless browser. Playwright works if installed
per-run (no global install in this repo):
```bash
mkdir -p /tmp/pw<name> && cd /tmp/pw<name> && npm install playwright --no-save
```
Chromium needs software GL in this sandbox: `chromium.launch({ args: ['--use-gl=swiftshader'] })`.

## Driving the globe (globe.js)
- **Ready signal**: poll `document.getElementById('globeHint').textContent` until it
  contains `클릭` (Korean for "click") — this only appears once textures + geometry
  finish building. Don't just `waitForTimeout` a guess.
- **Colorize**: click the center of `#globeCanvas` once. Wait ~1600ms for the crossfade
  (1400ms animation) to finish before screenshotting the "after" state.
- **Marker clicks are NOT reliably hit by eyeballed fractional coordinates.** The pink/blue
  dot texture is small; a candidate `[fx, fy]` that looks like it's "on" a marker in a
  screenshot often misses by enough to hit open globe instead. Always verify a candidate
  point actually opens the modal (check `#modalOverlay` hidden state) in isolation before
  reusing it in a multi-step test. A reliable way to find real hit points: take a
  screenshot, sample pixel colors with PIL to find marker glow centers precisely, then
  convert to fractions of the canvas bounding box.
- **Camera state carries across clicks in the same page.** After a marker click, the
  camera animates toward that city (`zoomToMarker`, ~1100ms). If you reuse the *original*
  pre-zoom fractional coordinates for a next click without reloading/resetting, they now
  point at a different part of the globe post-zoom — a follow-up "probe" can silently test
  nothing. Either reload the page between independent single-marker checks, or pick a
  second point before any zoom has happened.
- **Known pre-existing bug** (as of 2026-07, not yet fixed): rapid clicks on two different
  markers within ~150ms of each other can open a completely unrelated third university's
  modal, due to a shared (non-per-call) `isAnimatingCamera` flag in `zoomToMarker`. Confirmed
  reproducible: clicking "University of Hawaii at Hilo" then "Case Western Reserve
  University" 150ms apart opened "Xavier University" instead of either. Useful adversarial
  probe for any globe-related verification.
- **Objective color verification**: don't eyeball marker color from a screenshot. Sample
  pixels with PIL/Pillow and check channel dominance, e.g.:
  ```python
  from PIL import Image
  img = Image.open('shot.png').convert('RGB')
  # scan for max(B - max(R,G)) to find blue-dominant pixels, max(R - max(G,B)) for pink/red
  ```

## Cleanup
Always `pkill -f "http.server <port>"` and `rm -rf /tmp/pw<name>` when done — background
server/task-completion notifications after a `pkill` are expected, not errors.
