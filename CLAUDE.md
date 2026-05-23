# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Scrip** is a personal CLI tool (7-day sprint MVP) that converts handwritten course notes (photos) into structured Markdown files synced to an Obsidian vault. Target user: French lycée student (Gabi), budget 0€, free-tier APIs only.

**MVP focus:** `node ingest.js photo.jpg > note.md` — single subject (histoire), no WebDAV, no UI. Just: photo → OCR → structuring → markdown stdout. Validates the AI pipeline before building anything else.

## Commands

```bash
npm install          # install deps (dotenv only)
npm test             # run all tests
npm start <image>    # run CLI (requires .env)
node ingest.js photo.jpg > note.md   # pipe output to file

# Run a single test file
node --test tests/format.test.js
node --test tests/ocr.test.js
node --test tests/structure.test.js
```

## Architecture

**Runtime:** Node.js 20+ with native ESM, `fetch`, and `node:test`. Zero runtime deps beyond `dotenv`.

### Full Pipeline (post-MVP target)

```
[1] Photo capture (PWA / Tauri)
[2] Upload to Node.js backend
[3] Mistral OCR → raw markdown + bounding boxes
[4] Crop non-text regions → _assets/ images
[5] Gemma 4 via OpenRouter → structured markdown + fact-check
[6] Write: course.md + _audit/course.audit.md + _assets/*.png
[7] WebDAV sync → Obsidian vault (Remotely Save plugin)
```

### MVP Pipeline (current scope)

```
ingest.js → src/ocr.js → src/structure.js → src/format.js → stdout
```

### Source Modules

- **[src/format.js](src/format.js)** — Pure assembly: `buildNote(content, meta)` → YAML frontmatter + Markdown. No network, no other deps.
- **[src/ocr.js](src/ocr.js)** — Mistral OCR: `runOCR(imagePath, apiKey)` → `{ rawMarkdown, imageRegions }`. Base64-encodes image, returns raw text + bounding boxes.
- **[src/structure.js](src/structure.js)** — OpenRouter/Gemma 4: `structureContent(rawMarkdown, subject, level, apiKey)` → structured Markdown. Temperature 0.2 for deterministic output.
- **[ingest.js](ingest.js)** — CLI entry point. Chains OCR → structure → format. Progress to stderr, final note to stdout. Reads `MISTRAL_API_KEY`/`OPENROUTER_API_KEY` from `.env`, level from `SCRIP_LEVEL` env var (default: `1ère`).

### Prompt System

**[prompts/histoire.js](prompts/histoire.js)** — `HISTOIRE_SYSTEM_PROMPT` + `HISTOIRE_USER_TEMPLATE(ocrText)`. Tuned for French lycée history: H1/H2/H3 hierarchy, OCR error correction with context awareness, no fabrication, bracketed annotations for corrections.

To add a subject: create `prompts/<subject>.js`, add to the `PROMPTS` object in `src/structure.js`. MVP subjects planned: histoire, géographie, EMC, SVT.

## API Details

**Mistral OCR:** `POST https://api.mistral.ai/v1/ocr`, model `mistral-ocr-latest`, direct API (not via OpenRouter — better handwriting quality + native bounding boxes).
Response: `{ pages: [{ markdown, images: [{ id, top_left_x, top_left_y, bottom_right_x, bottom_right_y }] }] }`

**OpenRouter (primary):** `POST https://openrouter.ai/api/v1/chat/completions`, model `google/gemma-4-26b-a4b-it:free`. Headers: `HTTP-Referer: https://scrip.local`, `X-Title: Scrip`.

**OpenRouter (fallback LLM):** model `qwen/qwen3-next-80b-a3b-instruct:free` — activate if Gemma 4 leaves free tier (one-line change in `src/structure.js`).

## Configuration

Copy `.env.example` to `.env` and populate:
```
MISTRAL_API_KEY=...
OPENROUTER_API_KEY=...
```

Optional: `SCRIP_LEVEL` env var sets school level (default: `1ère`).

## Output Format

```markdown
---
matière: histoire
niveau: 1ère
date_cours: 2026-09-15
date_ingestion: 2026-09-15T18:42:00+02:00
tags: [cours, histoire, 1ere]
sources: [photo_01.jpg]
---

# <Titre du cours>

## <Section 1>

Texte structuré...

![Schéma 1](_assets/<titre>_schema_1.png)
```

Visuals are embedded in-flow, never appended at the end.

## Non-Text Region Strategy

Bounding boxes from Mistral OCR → crop source image → save as `_assets/<course>_schema_N.png` → reference in markdown as `![Schéma N](...)`. **No AI description of visuals** — hallucination risk too high on complex diagrams (SVT especially).

## Audit Log (post-MVP, non-negotiable)

Every ingested course produces `_audit/<course>.audit.md` with: ISO timestamp, models used, table of auto-corrections (original OCR → corrected → reason), detected visual regions. Corrections apply silently; the audit file is the safety net.

## Testing

Tests use `node:test` with `mock.fn()` replacing global `fetch` — no real network calls. `tests/fixtures/dummy.jpg` is a 1×1 JPEG for file I/O. Test files: `tests/*.test.js`.

Real test images: `IMG_2404.jpeg`, `IMG_2405.jpeg`, `IMG_2406.jpeg` (actual handwritten course photos, gitignored or kept local).

## Implementation Status

See [docs/superpowers/plans/2026-05-12-cli-mvp.md](docs/superpowers/plans/2026-05-12-cli-mvp.md). Full spec in [CDC_ingestor_cours_manuscrits_v2.md](CDC_ingestor_cours_manuscrits_v2.md).

MVP success criteria: end-to-end < 60s per photo, <10% of courses needing heavy manual review.
