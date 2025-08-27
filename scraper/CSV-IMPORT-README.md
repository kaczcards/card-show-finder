# 📊 CSV Importer for Card Show Finder

Bring entire show lists into the database **instantly** by importing a single `.csv` file.

---

## 1. Why CSV Import?

Some promoters already maintain their events in Excel/Sheets.  
Exporting those rows to **CSV** lets you skip web-scraping and go straight to a clean database insert.

```
CSV file ──▶ csv-importer.js ──▶ Supabase table `shows`
```

---

## 2. Minimum Requirements

| Column | Required? | Notes |
|--------|-----------|-------|
| `name`        | **Yes** | Full event title<br>(ex. *Dallas Card & Collectibles Show*) |
| `date`        | **Yes** | Any recognisable date (`YYYY-MM-DD`, `Jan 5 2026`, `1/5/26`) |
| `venue`       | **Yes** | Building / hall name |
| `address`     | **Yes** | Street address only (no city/state) |
| `city`        | **Yes** | City |
| `state`       | **Yes** | **2-letter** code (`TX`, `CA`) |
| `zip`         | **Yes** | `#####` or `#####-####` |
| `website`     | Optional | URL of show or promoter |
| `description` | Optional | Short marketing blurb |
| `admission`   | Optional | e.g. `$5`, `FREE` |
| `hours`       | Optional | e.g. `Sat 10–6; Sun 10–4` |
| `tables`      | Optional | Number of dealer tables |
| `contact`     | Optional | Promoter or contact name |
| `phone`       | Optional | `(555) 123-4567` |
| `email`       | Optional | support@example.com |

⚠️ **Column headers must match exactly** (lower-case, no spaces).

---

## 3. Quick Template

Save as **`my-shows.csv`**

```
name,date,venue,address,city,state,zip,website,description,admission,hours,tables,contact,phone,email
Dallas Card & Collectibles Show,2025-10-18,Irving Convention Center,500 W Las Colinas Blvd,Irving,TX,75039,https://dallascardshow.com,"Texas’ largest trading-card show",10,"Sat 10 am–6 pm; Sun 10 am–4 pm",600,"Kyle Robertson","214-555-8123",info@dallascardshow.com
```

---

## 4. CLI Usage

Run from project root (or `cd scraper` first).

| Example | What it does |
|---------|--------------|
| `node scraper/index.js --csv data/shows.csv` | Import all rows |
| `node scraper/index.js --csv data/shows.csv --state TX` | Only rows where `state=TX` |
| `node scraper/index.js --csv data/shows.csv --dry-run` | Validate & log, **no DB write** |
| `node scraper/index.js --csv data/shows.csv --verbose` | Detailed row-by-row output |
| `node scraper/index.js --csv data/shows.csv --output tmp/shows.json` | Write transformed JSON to file |

> The main scraper detects `--csv` and delegates to **`scraper/csv-importer.js`**.

---

## 5. Behind the Scenes

1. CSV rows are parsed and validated (required columns, date format, ZIP, etc.).  
2. Each row is transformed to the schema used by the `shows` table.  
3. Duplicate check: same `name + date + venue` updates existing row instead of inserting.  
4. `source = "csv_import"` so we know where the data came from.

---

## 6. Troubleshooting

| Problem | Likely Cause / Fix |
|---------|--------------------|
| **“Missing required field”** | Column header typo or blank cell. Check spelling & whitespace. |
| **“Invalid date format”** | Use recognisable formats: `YYYY-MM-DD` is safest. |
| **“State should be 2-letter code”** | Put `TX`, not “Texas”. |
| **“Invalid ZIP code”** | Use 5 or 9 digits only. |
| **Rows skipped silently** | Run with `--verbose` to see exact error per row. |
| **Supabase auth error** | Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are set (`setup-env.js`). |
| **Duplicate rows keep appearing** | The same event but different date? That's expected. Otherwise confirm `name`, `date`, `venue` exactly match existing DB row. |

---

## 7. FAQ

**Q: Do I need all optional columns?**  
A: No, leave them blank or delete them.

**Q: Can I split multi-day shows into one row?**  
A: Yes—put the **start date** in `date`. Multi-day ranges will be supported soon.

**Q: How many rows can I import at once?**  
A: Tested up to 5 000 rows; the script streams them efficiently.

---

## 8. Need Help?

Email **support@kaczcards.com** with:
- CSV file attached
- Command you ran
- Full error output (if any)

We’ll respond within 1 business day.  
Happy importing and happy collecting! 🎟️
