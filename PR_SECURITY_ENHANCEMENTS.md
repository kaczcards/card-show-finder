# PR: Security Enhancements – Global Rate-Limiting & Web-Application Firewall (WAF)

## 1 · Why this PR?

As Card Show Finder grows, we’re seeing higher traffic and more automated probing.  
This PR introduces two platform-wide protections that **shield every Supabase Edge Function**:

| Feature | Outcome |
|---------|---------|
| **Rate Limiter** (sliding-window) | Prevents brute-force, API abuse, denial-of-service bursts |
| **Web-Application Firewall (WAF)** | Detects / blocks OWASP Top-10 attack patterns (SQL-i, XSS, SSRF, etc.) |

Both are plug-and-play middleware and already wired into `/stripe-webhook`, `/mfa`, and all new functions via `applySecurity()`.

---

## 2 · How this Improves Security

1. **Abuse mitigation** – per-IP & per-user caps (e.g. 10 auth attempts / min) stop credential-stuffing and enumeration.
2. **Attack surface reduction** – malicious payloads never reach business logic; WAF blocks at entry.
3. **Centralised auditing** – two new Postgres tables (`rate_limits`, `waf_logs`) give a single source of truth for security telemetry.
4. **Defence in depth** – sits in front of MFA, Stripe, and all sensitive flows; combines with MFA & RLS for layered security.

---

## 3 · Implementation Details

### 3.1 Shared Middleware

```
supabase/functions/_shared/
  ├─ rate-limit.ts      <- sliding-window algorithm, Postgres-backed
  ├─ waf.ts             <- rule engine + 40+ curated regex rules
  └─ security.ts        <- glue: rateLimit + WAF + auth + sec-headers
```

`applySecurity(req, config)` is a one-liner that:

1. Checks IP against optional `trustedIps`.
2. Applies rate-limit policy (`default | auth | api | payment | admin | webhook`).
3. Runs WAF rule set at chosen protection level (`LOW / MEDIUM / HIGH / MAXIMUM`).
4. Optionally verifies JWT & RBAC.
5. Adds standard security headers & CORS.

### 3.2 Database

* `rate_limits` – composite PK `(key, endpoint)`, auto-expires, cron cleanup.
* `waf_logs`    – full JSONB of sanitized headers / params, indexed by `timestamp`, `severity`.

Migration: `supabase/migrations/20250721000000_add_security_tables.sql`

### 3.3 Default Policies

| Policy | Window | Limit | Typical Endpoints |
|--------|--------|-------|-------------------|
| default | 60 s | 60 | misc |
| auth    | 60 s | 10 | `/mfa/*`, `/login` |
| api     | 60 s | 120| public JSON APIs |
| payment | 60 s | 20 | `/create-payment-intent`, webhooks |
| admin   | 60 s | 300| dashboards |
| webhook | 60 s | 120| Stripe, Postmark, etc |

Levels may be overridden per call.

### 3.4 Integration Points

* `stripe-webhook/index.ts` – now wrapped with `applySecurity(req, "webhook")`
* `mfa/index.ts`            – wrapped with `applySecurity(req, "auth")`
* Future functions: call once at top of handler.

---

## 4 · Testing Performed

| Test | Method | Result |
|------|--------|--------|
| Rate-limit hit | cURL loop 11× `/mfa/status` in <60 s | 11th request → **429** with `RateLimit-*` headers |
| SQL-i WAF rule | `name=' OR 1=1 --` to `/mfa/authenticate` | **403** `WAF_BLOCK`, row in `waf_logs` (`sqli-001`) |
| XSS WAF rule | `<script>alert(1)</script>` param | **403**, rule `xss-001` |
| Legit traffic | 200 auth & webhook calls | No false-positives, <3 ms overhead |
| Log retention | ran `cleanup_old_waf_logs(1)` | old rows purged, function returns count |
| Concurrency | 500 RPS k6 burst on `/stripe-webhook` | 0 errors, counters aggregated correctly |

All tests executed in staging project; detailed logs attached to Jira SEC-42.

---

## 5 · Deployment Instructions

1. **Apply migration**

```bash
supabase db push \
  --file supabase/migrations/20250721000000_add_security_tables.sql
```

2. **Deploy updated shared libs & functions**

```bash
supabase functions deploy stripe-webhook mfa --project-ref <project-ref>
```

(Any other functions should be re-deployed to pick up shared code.)

3. **(Optional) Enable pg_cron**

Uncomment the two `cron.schedule` lines in the migration or schedule via Dashboard to auto-purge expired rows.

4. **Monitor**

```sql
SELECT * FROM waf_logs ORDER BY timestamp DESC LIMIT 20;
SELECT * FROM rate_limits ORDER BY last_request_at DESC LIMIT 20;
```

5. **Tune**

Adjust limits in `DEFAULT_RATE_LIMITS` or add `trustedIps` for CI/CD as needed.

---

## 6 · Reviewer Checklist

- [ ] Migration applies cleanly on staging.
- [ ] Shared middleware compiles in all functions (no missing imports).
- [ ] Acceptable latency overhead (<5 ms avg).
- [ ] No legitimate endpoints blocked (check staging logs).
- [ ] Secrets (`SUPABASE_SERVICE_ROLE_KEY`) present in Functions env.

---

### 🚀  Safe-guarding our platform one layer deeper.  Thank you for reviewing!
