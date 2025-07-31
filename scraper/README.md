# Card-Show Scraper CLI

Welcome to **Quest 2: “20 Flashcards”** – a lightweight command-line tool that lets you scrape trading-card show information locally before pushing it through the existing Supabase pipeline.

---

## 1.  Overview – “20 Flashcards”

* **Goal**: Provide a quick, seed-driven way to test the scraping pipeline without manually specifying URLs every time.
* **Flashcards metaphor**: The tool shuffles through a deck of 20 pre-defined “flashcards” (state + URL pairs) stored in `scraper/seed_urls.json`.
* **Zero-config runs**: If you do **not** pass `--url`, the CLI automatically loads this file and, optionally, filters by `--state` to decide which URLs to process.

---

## 2.  How `seed_urls.json` Works

`scraper/seed_urls.json` is a simple JSON array of objects:

```json
[
  { "state": "TX", "url": "https://texascardshows.com/upcoming-events" },
  { "state": "CA", "url": "https://socalsportscards.com/shows" },
  ...
]
```

Key points  
* Exactly **20** entries – one “flashcard” per state/URL combination.  
* `state` must be a 2-letter USPS code (case-insensitive when filtered).  
* The file is **source-controlled** so everyone runs the same baseline tests.  
* You can add more entries locally for experimentation; the CLI will happily ingest extras.

---

## 3.  Environment Setup

The scraper re-uses the same backend services as the Edge Function, so three environment variables are required:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (required for inserting data) |
| `GOOGLE_AI_KEY` | Google Gemini API key |

You can export them in a shell, use a *.env* file, or pass inline:

```bash
export SUPABASE_URL="https://xyz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="service_role_key_here"
export GOOGLE_AI_KEY="ai_key_here"
```

Dependencies  
```bash
npm install   # installs minimist + peer deps
```

---

## 4.  Command-Line Usage

```bash
# General syntax
node scraper/index.js [options]

Options:
  -s, --state  <STATE>   Two-letter state filter (e.g. TX)
  -u, --url    <URL>     Scrape a single URL (bypasses seed file)
  -h, --help             Show help text
```

### Quick Examples

| Scenario | Command |
|----------|---------|
| Scrape all 20 flashcards | `npm run scraper` |
| Scrape only Texas cards  | `npm run scraper -- --state TX` |
| Same as above (alias)    | `npm run scraper:tx` |
| Scrape a single site     | `npm run scraper -- --url https://example.com` |
| Mixed (state ignored when URL supplied) | `node scraper/index.js --url https://example.com --state CA` |
| Show full help | `npm run scraper:help` |

---

## 5.  State Filtering Logic

1. **Normalization** – The CLI forces whatever you pass (`tx`, `Tx`, `Texas`) into the canonical 2-letter uppercase code (`TX`). Only the first two characters are considered.  
2. **Filter pass** – Each seed entry whose `state` matches is kept; others are skipped.  
3. **Graceful empty set** – If no flashcards match, the CLI exits with a friendly notice and status 0 (no error).

---

## 6.  End-to-End Flow

```
┌────────────────────┐
│ CLI Parameters     │
└─────────┬──────────┘
          │
          │ (no --url)              
          ▼
┌────────────────────┐
│ Load seed_urls.json│
└─────────┬──────────┘
          │
          │ (optional --state filter)
          ▼
┌────────────────────┐
│ URL Queue          │  (1–20 items)
└─────────┬──────────┘
          │  sequential processing
          ▼
┌────────────────────┐   inserts
│ Supabase RPC/DB    │◀──────────────┐
└────────────────────┘               │
                                     │
                         ┌───────────▼────────────┐
                         │ scraped_shows_pending  │
                         └────────────────────────┘
```

---

## 7.  Integration with the **scraper-agent** Edge Function

* **Same schema** – The CLI writes to `scraped_shows_pending`, identical to what the Edge Function uses in production.
* **Priority & error streak RPCs** – After each URL, the CLI calls the same `increment_priority`, `decrement_priority`, and `increment_error_streak` Postgres functions so the two systems share state.
* **Development workflow**  
  1. Run the CLI locally to test new parsing logic without redeploying an Edge Function.  
  2. Verify rows appear in Supabase.  
  3. Deploy or schedule the `/functions/v1/scraper-agent` Edge Function when ready for production load.

---

## 8.  Practical Use Cases

1. **Contributor onboarding** – Clone the repo, export your keys, run `npm run scraper` to verify everything works.  
2. **Parser tuning** – Add a new flashcard entry, tweak prompt logic, and immediately see results in `scraped_shows_pending`.  
3. **Regional focus** – QA team only interested in Midwest shows? `--state IN`,`--state OH`, etc.  
4. **Regression testing** – Add historical URLs to the deck and run the CLI in CI to ensure future code changes don’t break existing extraction.

---

## 9.  Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `Missing Supabase URL` | Env var not set | `export SUPABASE_URL=...` |
| `Missing Google AI API key` | No Gemini key | Obtain key from Google AI Studio |
| `No URLs found for state XX` | Wrong state code | Check `seed_urls.json` or pass correct `--state` |

---

Happy scraping!  
*— The Card-Show-Finder Team*
