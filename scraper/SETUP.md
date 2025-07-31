# Card-Show Scraper – Setup Guide
*Run the CSV batch scraper on “show list - Sheet1.csv” and push shows into `scraped_shows_pending`.*

---

## 1. Clone & Install

```bash
git clone https://github.com/kaczcards/card-show-finder.git
cd card-show-finder
npm install          # installs minimist, csv-parse, @supabase/supabase-js, etc.
```

---

## 2. Configure Environment Variables

1. Copy the template:

```bash
cp scraper/.env.example scraper/.env
```

2. Open `scraper/.env` and fill in **three required values**

| Variable | Where to get it | Notes |
|----------|-----------------|-------|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Format: `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → *service_role* | **Admin-level** – never expose publicly |
| `GOOGLE_AI_KEY` | [Google AI Studio](https://makersuite.google.com/app/apikey) | Gemini API key |

3. Load the variables for the current shell:

```bash
source scraper/.env
```

(Or export them in your shell profile.)

---

## 3. Run the CSV Batch Scraper

The CSV file already lives at `scraper/show list - Sheet1.csv`.

```bash
# Default: process every URL (batch of 5, 2-second delay)
npm run scraper:csv
```

### Common Variants

| Goal | Command |
|------|---------|
| Only scrape Indiana URLs | `npm run scraper:csv -- --state IN` |
| Larger batches (10) & 5-second delay | `npm run scraper:csv -- --batch 10 --delay 5000` |
| Show full CLI help | `npm run scraper:csv:help` |

**Flags**

* `--state <XX>` – two-letter filter, case-insensitive  
* `--batch <N>`  – how many URLs to process sequentially before a longer pause (default `5`)  
* `--delay <ms>` – delay between each URL (and `delay*2` between batches)  
* `--help`       – prints usage

---

## 4. What You’ll See

During execution you'll get block-style logs, e.g.:

```
================================================================================
Processing URL: https://dpmsportscards.com/ (State: IN)
================================================================================
HTML fetched (124 112 bytes). Chunking & extracting with AI...
Chunk 1 ⇒ 3 shows
Chunk 2 ⇒ 1 shows
Extracted total 4 shows. Inserting...
Successfully inserted 4 of 4 shows (filtered 0 past/invalid)
```

At the end:

```
CSV Batch Scraper completed in 158.23s (2.64 minutes)
{
  "totalUrls": 71,
  "successfulScrapes": 63,
  "failedScrapes": 8,
  "totalShowsFound": 312,
  "stateFilter": "None"
}
```

### Where are the results?

Inserted rows appear in the database table:

```
scraped_shows_pending
```

Each row’s `raw_payload` contains the extracted event data and a `sourceNotes` field (the “odd notes” column from the CSV).

---

## 5. Tips: Batching & Rate-Limits

| Situation | Recommendation |
|-----------|----------------|
| **429 / rate-limit** | Increase `--delay`, lower `--batch`. |
| **Large HTML pages** | Keep default batch size (5) to avoid memory spikes. |
| **Very slow sites**  | Export `TIMEOUT_MS=40000` before running to extend fetch timeout. |
| **Gemini quota**     | Split the run per state (`--state FL`, `--state CA`, …) to spread calls over days. |

---

## 6. Troubleshooting

| Error Message | Likely Cause | Fix |
|---------------|-------------|-----|
| `Missing Supabase URL` | `.env` not loaded | `source scraper/.env` or export variable |
| `AI error on chunk … 403` | Wrong/expired `GOOGLE_AI_KEY` | Regenerate key in AI Studio |
| `HTTP Error 404` | Site moved | Update URL in CSV |
| `Failed to parse AI response` | Non-JSON output | Re-run later, or add site-specific note and handle manually |
| **No shows inserted** but HTML fetched | Site lists past events only | Not a bug – scraper filters past dates by design |

---

## 7. Quick One-Liners

```bash
# Scrape only CA & TX, 3 URLs at a time, 3-second delay
for st in CA TX; do npm run scraper:csv -- --state $st --batch 3 --delay 3000; done

# Dry-run a single tricky site without touching DB (uses local CLI scraper)
SUPABASE_SERVICE_ROLE_KEY=dummy \
npm run scraper -- --url https://example.com --state NY
```

---

Happy scraping!  
If you hit an edge-case site, add a note in the CSV **and** open an issue so we can improve the AI prompts. 