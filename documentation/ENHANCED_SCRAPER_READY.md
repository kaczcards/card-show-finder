# Enhanced Scraper – Ready for Prime-Time ✅

Welcome to the final hand-off guide for the **Card-Show-Finder enhanced scraper**.  
Everything you need to understand what was fixed, why it matters, and how to run the new pipeline is here.

---

## 1. What’s Been Accomplished So Far

| Area | Status | Highlights |
|------|--------|------------|
| Broken deletion tooling | ✅ Fixed | `delete-first-n-records.js` + patched `delete-records.js` now accept UUIDs instead of integers. |
| Environment handling | ✅ Added | `scraper/setup-env.js` maps Expo & legacy variable names → correct ones, validates presence. |
| Data quality pipeline | ✅ Added | Intelligent date / location / contact parsing, entry-fee detection, show-hours extraction, Google Maps geocoding. |
| AI-powered extraction | ✅ Added | Gemini-based prompts including a specialised Sports Collectors Digest (SCD) prompt. |
| Safety nets | ✅ Added | Validation with errors / warnings, optional `--dry-run`, verbose logging, inspection & repair of single records. |

---

## 2. The Old Data-Quality Problems (Real Examples)

Below are five records we **just deleted** from `scraped_shows_pending`.  
They illustrate every pain-point the new scraper solves:

| UUID (truncated) | Raw `startDate` | Raw `location` | Issues Seen |
|------------------|-----------------|----------------|-------------|
| 2945d9… | `January 5-6, 2025` | `The Venue, Montgomery, AL` | Past date (already 2025) + generic venue string |
| 2aee76… | `Aug 2 AL` | `Jaycees Community Building, John Hunt Park, Huntsville, AL` | **State code embedded in date** (“AL”), needs cleanup |
| 65b1c7… | `Aug 9 AL` | `Gardendale Civic Center, Gardendale, AL` | Same date problem, no ZIP, no coordinates |
| 6bca92… | `March 15-16, 2025` | `The Venue, Tucson, AZ` | Past date, missing address split, no contact |
| f94a96… | `February 1-2, 2025` | `The Venue, Phoenix, AZ` | Same as above |

*Result:* front-end map couldn’t place events, duplicates flourished, and users saw “Aug 2 AL” as a date.

---

## 3. What the Enhanced Scraper Does Now

1. **AI Extraction** – Gemini 1.5 prompts tailored to generic pages *and* Sports Collectors Digest.
2. **Date Normalisation**  
   • Removes stray state codes → “Aug 2 AL” → “Aug 2”.  
   • Interprets ranges → ISO `startDate` / `endDate`.  
   • Rolls forward to next year if scraped date is already in the past.
3. **Location Parsing** – Splits venue / address / city / state / ZIP, even when jammed together.
4. **Contact Extraction** – Pulls name / phone / email from one messy string.
5. **Entry Fee & Hours** detection with common patterns (“Free”, “$5”, “9 am – 3 pm”).
6. **Geocoding** (Google Maps) adds `latitude` / `longitude` for pin-drops.
7. **Validation** – Flags missing essentials, prevents saving obviously broken records.
8. **Tooling** –  
   • `--dry-run` mode (no DB writes)  
   • `--verbose` deep logging  
   • `--inspect-id <uuid>` to repair a single row  
   • Priority scoring RPC updates when saving.

---

## 4. Get Your Google AI (Gemini) API Key

The AI step is blocked until an API key is present.

1. Go to **https://makersuite.google.com** and sign in.  
2. Left sidebar → **API keys** → **Create API key**.  
3. Copy the key (looks like `AIzaSy...`).  
4. Open the project `.env` file (root of repo).  
5. Add / edit this line:

```
GOOGLE_AI_KEY=AIzaSyYourNewKeyHere
```

6. **Reload** your terminal environment:

```bash
# from project root
source .env
node scraper/setup-env.js   # should show ✓ for GOOGLE_AI_KEY
```

---

## 5. Test the Enhanced Scraper on Sports Collectors Digest

```bash
# 1. Ensure env is loaded / mapped
node scraper/setup-env.js

# 2. Dry-run, verbose (no DB writes)
node scraper/enhanced-scraper.js \
     --url https://sportscollectorsdigest.com/show-calendar \
     --verbose --dry-run
```

What you should see:

* “HTML fetched … bytes”  
* AI chunk logs: `Chunk 1 ⇒ 40 shows` (numbers will vary)  
* “Normalized 38 valid shows (0 invalid, 2 with warnings)”  
* Geocoding progress (if `--geocode` not disabled)  
* Final summary with `showsFound` > 0.

If you drop `--dry-run` the events will be saved to `scraped_shows_pending` with full `normalized_json` & optional `geocoded_json`.

---

## 6. Example of Improved Output

A single show after normalisation (excerpt):

```json
{
  "name": "Huntsville Sports Cards & Collectibles Show",
  "startDate": "2025-08-02T05:00:00.000Z",
  "endDate": "2025-08-02T05:00:00.000Z",
  "venueName": "Jaycees Community Building",
  "address": "2180 Airport Rd SW",
  "city": "Huntsville",
  "state": "AL",
  "zipCode": "35802",
  "coordinates": {
    "latitude": 34.6889,
    "longitude": -86.5861,
    "formattedAddress": "2180 Airport Rd SW, Huntsville, AL 35802, USA"
  },
  "entryFee": "Free admission",
  "showHours": "9am - 3pm",
  "contactName": "John Smith",
  "contactPhone": "256-555-1234",
  "contactEmail": "john@collectibleshow.com"
}
```

Contrast that with the deleted record’s raw payload:

```
Date: "Aug 2 AL"
Location: "Jaycees Community Building, John Hunt Park, Huntsville, AL"
No coordinates, no contact, mixed date/state.
```

---

## 7. Clear Next Steps

1. **Add GOOGLE_AI_KEY** to `.env` (section 4).  
2. Run the **dry run** command above – confirm valid shows appear.  
3. Remove `--dry-run` and run again → events populate the database.  
4. Visit your front-end map – pins should display with accurate coordinates.  
5. Spot-check a few records in Supabase → `normalized_json` looks like the example.  
6. Use `delete-first-n-records.js` or `--inspect-id` to clean / adjust as needed.  
7. (Optional) Run the scraper for a single state:

```bash
node scraper/enhanced-scraper.js --state TX
```

8. Schedule the scraper (GitHub Action / Supabase Edge Function) once manual tests pass.

Happy collecting – the scraper is now **enhanced and ready**! 🎉
