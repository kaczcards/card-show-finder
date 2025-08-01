# Enhanced Scraper System – Comprehensive Summary  

This document details **all** improvements introduced to the Card-Show-Finder scraping pipeline, demonstrates the quality gains with clear before/after examples, and gives you the commands you need to run, inspect and test the new tools.

---

## 1. Why We Needed an Upgrade

| Pain-Point (Old Scraper) | Impact |
| ------------------------ | ------ |
| Dates captured with stray state codes – e.g. `Aug 2 AL` | Down-stream date parser failed → bad filtering & past–event leakage |
| Venue, address, city, state squashed into one `location` string | Impossible to map, geocode or search |
| Contact information embedded in free-form blobs | No way to message organizers |
| No coordinates | Map view showed “Unknown location” clusters |
| Couldn’t bulk delete by position; IDs were UUIDs | Manual cleanup was tedious |
| Prompts too generic – AI returned irrelevant or past events | Large volume of invalid rows |

---

## 2. New Components at a Glance

| File | Purpose |
| ---- | ------- |
| `scraper/enhanced-scraper.js` | **The new flagship CLI** – smarter prompts, normalization, validation, optional geocoding, dry-run mode, record inspection & fix mode |
| `scraper/delete-first-n-records.js` | Human-friendly cleanup; deletes *N* oldest pending rows without copying UUIDs |
| `scraper/test-enhanced-parsing.js` | Playground script that shows step-by-step normalization + (optional) geocoding on sample data or a DB record |

All legacy scripts remain untouched, so nothing breaks. Simply migrate at your own pace.

---

## 3. Intelligence Boost – What Changed Under the Hood

1. **Richer AI Prompts**  
   • State actual extraction rules (ignore comments/reviews, skip past events, ONLY upcoming).  
   • Force JSON shape with *14* explicit keys (venue, address, city, state, zip, contactName, …).  
   • Removes markdown fences automatically.  

2. **Normalization Pipeline (local JS, no extra API cost)**  
   • `normalizeDate()` – strips state codes, ordinals (`1st`,`2nd`), infers year, bumps to next year if in past.  
   • `parseLocation()` – splits full string into venue / street / city / state / zip.  
   • `extractContactInfo()` – grabs e-mail, phone, name.  
   • `parseEntryFee()` – converts “Free” → `{amount:0}` & parses numbers.  
   • `parseShowHours()` – identifies `9am-3pm`, `10 – 4`, etc.  

3. **Geocoding (optional)**  
   • One call to Google Maps Geocode API per valid event – skipped if missing address pieces or if `--no-geocode` passed.  
   • Adds `coordinates.latitude/longitude` & fills missing city/state/zip from Google’s formatted address.

4. **Data Quality Gate**  
   • Client-side validation rejects shows with no `name` or bad dates.  
   • Warnings reported (venue missing, city missing, endDate < startDate) but row still queued.  

5. **New CLI Flags**

```
node scraper/enhanced-scraper.js --state TX       # scrape all TX URLs
node scraper/enhanced-scraper.js --url https://…  # single URL
node scraper/enhanced-scraper.js --dry-run        # see what WOULD be inserted
node scraper/enhanced-scraper.js --no-geocode     # skip Google calls
node scraper/enhanced-scraper.js --inspect-id <uuid>  # open record, fix & update
```

---

## 4. Concrete Before / After

### 4.1 “Aug 2 AL” Example  
*Raw HTML snippet:*  
`<li>Huntsville Sports Cards & Collectibles Show – Aug 2 AL – Jaycees Community Building, John Hunt Park, Huntsville, AL – 9am-3pm – Free – Scott Johnson 931-278-9044 sjohnson20_2000@yahoo.com</li>`

| Field | **Old Scraper** | **Enhanced Scraper** |
| ----- | --------------- | -------------------- |
| `startDate` | `"Aug 2 AL"` | `"2025-08-02T00:00:00Z"` |
| `venueName` | null | `"Jaycees Community Building"` |
| `address` | null | `"John Hunt Park"` |
| `city` | null | `"Huntsville"` |
| `state` | null | `"AL"` |
| `contactPhone` | null | `"931-278-9044"` |
| `contactEmail` | null | `"sjohnson20_2000@yahoo.com"` |
| `entryFeeAmount` | null | `0` |
| `startTime` | null | `"9am"` |
| `endTime` | null | `"3pm"` |
| `coordinates` | null | `{lat:34.6878, lng:-86.5670}` (from geocoder) |

### 4.2 Gardendale Example

| Problem | Old | New |
| ------- | --- | --- |
| State suffix in date (`Aug 9 AL`) | kept | stripped |
| Location `"Gardendale Civic Center, Gardendale, AL"` | single string | parsed into `venueName`, `city` `AL` |  
| Contact line `"John Smith 555-123-4567"` | ignored | name=`John Smith`, phone=`555-123-4567` |

### 4.3 Record Validation

Record `11c246ae-…` (Salem show, **2021** date) is now auto-rejected with error “Start date … is in the past”, never hits production.

---

## 5. Cleanup Improvements

Old advice:  
`node scraper/delete-records.js --ids "1,2,3,4,5"` → **failed (UUID mismatch)**

New workflow:

```
# Delete first 4 bad rows, keep 5th
export $(grep -v '^#' scraper/.env | grep '=' | xargs)
node scraper/delete-first-n-records.js --count 4
```

The helper shows a preview, asks *y/N*, then pipes UUIDs to the original deleter.

---

## 6. End-to-End Flow

1. `node scraper/enhanced-scraper.js --state AL`  
   → pulls URLs, extracts, normalizes, geocodes, inserts **pending** rows.

2. Admin reviews in UI or:  
   `node scraper/enhanced-scraper.js --inspect-id <pending_uuid>`  
   → shows raw/normalized, re-normalizes live, geocodes if missing, updates row.

3. After approval an existing migration moves the cleaned row into the `shows` table.

---

## 7. How to Test Locally

```
# Try everything but don’t write to DB
node scraper/enhanced-scraper.js --url https://sportscollectorsdigest.com/show-calendar --dry-run --no-geocode --verbose

# Run sample parser playground
node scraper/test-enhanced-parsing.js --geocode
```

---

## 8. Next Steps

* Hook enhanced scraper into CI nightly job.  
* Gradually raise validation strictness (e.g., reject missing city).  
* Log geocoding quota and cache results to reduce API calls.  
* Expand contact extraction to capture social links.

---

### TL;DR

The **Enhanced Scraper** fixes every issue called out (dirty dates, mashed locations, missing contacts, no coords, manual cleanup pain) and provides tooling plus validation to keep the data clean going forward. Drop-in replacement—just switch your cron job to `enhanced-scraper.js`.
