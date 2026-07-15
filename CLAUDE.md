# Exchange Program University Explorer — Project Spec

## Overview
A single-page website that helps me explore university exchange program options
on an interactive 3D globe. I click on countries, universities pop up, and I can
see all the details I need to decide where to apply.

## Data Source
All university data lives in `data/universities_english.json`.
This file is the single source of truth — do not hardcode university data in the
JS/HTML. Each record has this schema:

```json
{
  "id": 1,
  "name": "Concordia University",
  "continent": "North America",
  "country": "Canada",
  "city": "Montreal",
  "gpa_requirement": "3.0+ (out of 4.3)",
  "language_requirement": "iBT 79+ or IELTS 6.0+",
  "toefl_myBestScore_accepted": "인정 / 불가",
  "students_per_semester": 5,
  "level": "학부 / 대학원",
  "major_restriction": "string or null",
  "semester_restriction": "string or null",
  "website": "url",
  "academic_calendar": "string",
  "notes": "long descriptive text"
}
```

**Note:** This dataset has already been filtered to only include universities
that teach exchange-student courses in English, and Asian-continent universities
have already been removed. Do not re-add Asian countries or non-English-taught
universities. If the JSON is ever regenerated, it must keep both of these filters.

## Fields to Display Per University
When a university is selected, show a detail card with:
- University name (title)
- Country / City
- World university ranking (not in the current data — placeholder/TBD until a
  ranking dataset is added)
- Ranking for film/moviemaking major specifically (not in current data —
  placeholder/TBD until added)
- TOEFL/IELTS acceptance score
- GPA requirement
- Number of students accepted per semester
- Class/studio/equipment access restrictions for exchange students (from
  `major_restriction` / `notes`)
- Part-time work info for exchange students: allowed or not, typical pay per
  hour, language required (not in current data — placeholder/TBD, needs
  separate research per country)
- Immigration/visa difficulty for a Korean citizen specifically, and in general
  (not in current data — placeholder/TBD, needs separate research per country)

Where data is missing, show "Data not yet available" rather than leaving a
blank field or guessing.

## Globe Behavior (core interaction)

1. **Default state (page load):** the 3D Earth renders in **grayscale/black-and-
   white** — same landmasses and terrain detail as the color version, just
   desaturated. Reference look: realistic terrain globe (see attached reference
   images), just without color.

2. **Click to activate:** the first time the user clicks anywhere on the globe,
   it smoothly transitions/fades into full realistic color (blue oceans, green/
   tan landmasses — like the reference images).

3. **Navigation, like Google Maps:** after colorized, the globe must be:
   - Draggable with mouse/touch to rotate freely in any direction
   - Zoomable with scroll or pinch
   - Never navigates away from the page or opens external links/tabs on any
     click — everything happens in-page

4. **University markers:** each university in the JSON appears as a small pin
   at its approximate city location.
   - Markers should stay visually clean when zoomed out (cluster or hide by
     zoom level if needed to avoid clutter)
   - Markers become clearly visible/separated when zoomed into a region

5. **Clicking a marker:**
   - Camera smoothly zooms/pans into that city/region
   - An info panel/card opens with that university's full details (see "Fields
     to Display" above)
   - Panel does NOT navigate away from the page

6. **Coastal/surf indicator:** if a university's city is on a coast suitable
   for swimming/surfing, show a 🏄 emoji next to the city name in the detail
   card. (This needs to be manually tagged per city — add a `coastal_surf: true/false`
   field to the JSON as this gets researched, defaulting to false/absent for now.)

## Visual Design
- University names and key data labels: **pink text with a black outline/frame**
- Background/globe: realistic Earth colors once activated; grayscale before
  activation
- Clean, modern layout — the globe is the hero/main interactive element,
  detail panel appears as an overlay or side panel without covering the whole
  globe
- Style should feel premium/polished, not like a generic Bootstrap template

## Technical Notes
- Build as a static site: `index.html` + separate CSS/JS files
- Use a 3D library suited for an interactive textured globe with markers —
  e.g. Three.js (recommended) or a WebGL globe library (e.g. globe.gl, which
  is built on Three.js and has built-in marker/label support — worth
  considering to save time on marker placement and camera-to-point animation)
- All data is local (`data/universities_english.json`) — no backend, no API
  calls needed
- No external navigation on any click — this is a strict requirement, not a
  nice-to-have
- Should run by simply opening `index.html` in a browser (no build step
  required), unless a bundler is genuinely necessary for the 3D library — if
  so, explain why before adding one

## Explicitly Out of Scope For Now
- World university rankings dataset
- Film/moviemaking major-specific rankings
- Part-time work regulations per country
- Immigration/visa difficulty per country for Korean citizens
(All of the above are placeholders in the UI until I provide or request that
data separately.)
