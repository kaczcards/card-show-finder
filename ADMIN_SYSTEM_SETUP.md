# Card Show Finder – Admin Evaluation System Setup

## 1. Overview
The admin evaluation system provides everything an administrator needs to review, approve, reject, and analyse scraped card-show data.

Implemented components  
• Database layer – SQL functions & a view for metrics, batch actions, duplicate detection, and priority tuning  
• Service layer  – Pure-JS equivalents of the SQL helpers (works even before DB migration succeeds)  
• Tooling          – Interactive CLI (`admin_cli_simple.js`) and non-interactive test script (`test-admin-cli.js`)  
All pieces run against your production Supabase project using the credentials in `.env`.

---

## 2. Key Files & Purposes

| File | Purpose |
|------|---------|
| **sql/admin_feedback_functions.sql** | Canonical definitions of 7 helper functions + 1 view (can be applied as a migration). |
| **install-admin-functions.js** | Installs the SQL helpers via Supabase CLI (migrations approach). |
| **simple-admin-functions.js** | Pure-JS fallback implementations of every helper; no DDL required. |
| **admin_cli_simple.js** | Full-featured TUI for admins (list shows, batch approve/reject, stats, duplicates, export). |
| **test-admin-cli.js** | Scriptable smoke-test invoking every helper and printing tabular results. |
| **.env** | Holds `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, etc. |

_Note: The legacy `admin_review_cli.js` (Edge-Function variant) remains in the repo but is superseded by the simple CLI above._

---

## 3. Helper Functions

Name | Summary
-----|--------
`get_feedback_stats(days_ago, min_count)` | Tag-level rejection analytics (+ trend & source distribution).
`get_source_stats(days_ago, min_shows)` | Performance KPIs for each scraping source (approval %, quality, issues).
`find_duplicate_pending_shows(similarity_threshold, max_results)` | Fuzzy match pending rows for duplicates.
`calculate_source_rejection_rate(days_ago, min_shows)` | Suggest priority changes based on rejection rates.
`approve_pending_batch(show_ids, admin_id, feedback, min_quality)` | Safe mass approval with validation.
`reject_pending_batch(show_ids, admin_id, feedback)` | Safe mass rejection (feedback mandatory).
`update_source_priorities(days_ago, min_shows, dry_run)` | Apply/simulate priority adjustments.
`pending_quality_view` | Read-only view exposing quality score, band, and potential issues per pending show.

The same semantics are mirrored in `simple-admin-functions.js` for direct JS execution.

---

## 4. Using the CLI Tool

1. `npm i` (installs CLI deps: inquirer, chalk, console-table-printer, dateformat, csv-writer, open)  
2. Ensure `.env` contains  
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_KEY=<service-role-or-temp-key>
   ```  
3. Launch:  
   ```bash
   node admin_cli_simple.js
   ```  
4. Menu options  
   • View pending shows – interactive approval/rejection with feedback tags  
   • Feedback statistics – trend analysis, top sources, recommendations  
   • Source performance – approval %, quality, common issues, priority hints  
   • Find duplicates – guided resolution workflow  
   • Export data – pending, stats or feedback → CSV / JSON

Tips  
• Batch-approve high-quality rows via “Batch approve high quality shows”.  
• All write actions immediately update `scraped_shows_pending` and log to `admin_feedback`.

---

## 5. Testing Procedures

Quick smoke test (no prompts):

```bash
node test-admin-cli.js
```

The script:
1. Connects to Supabase with env vars.
2. Calls each helper (`getFeedbackStats`, `getSourceStats`, etc.).
3. Prints tidy tables for visual verification.

Successful run = no thrown errors. Empty tables simply mean no data yet.

---

## 6. Next Steps When Shows Arrive

1. **Apply SQL migration (optional)**  
   ```
   npx supabase db push --include-all
   ```  
   or run `install-admin-functions.js` if you prefer manual SQL execution.

2. **Process new rows**  
   • Run `node admin_cli_simple.js` ➜ “View pending shows”  
   • Approve/reject individually or in batches.  
   • Use duplicate finder before mass approvals.

3. **Monitor quality**  
   • Check “Feedback statistics” after first rejection wave.  
   • Tweak scraper / parsers based on top issues.

4. **Tune source priorities**  
   • Execute SQL function `update_source_priorities(dry_run => true)` to preview changes.  
   • Remove `dry_run` to apply.

5. **Iterate**  
   Re-run tests, exports, and stats as the dataset grows.

---  
Documentation last updated: 29 Jul 2025
