# Security Hardening Guide  
Card Show Finder – Rate-Limiting & Web-Application Firewall (WAF)  
_Last updated: 2025-07-21_

---

## 0. Overview

This document explains the **built-in security layer** that now protects every Supabase Edge Function:

1. **Rate Limiting** – blocks abusive traffic (DoS, brute-force).  
2. **Web Application Firewall (WAF)** – detects & optionally blocks OWASP-style attacks (SQL-i, XSS, SSRF, …).  
3. **Unified Middleware** – `applySecurity()` combines rate-limit, WAF, auth & security headers in one call.  
4. **Audit Tables** – `rate_limits`, `waf_logs`, plus helper SQL for monitoring and cleanup.

You will learn how to configure, deploy, monitor, and troubleshoot these defences.

---

## 1. Architecture

```
┌─────────┐      ┌────────────────────────────┐
│ Client  │ ───► │ Edge Function (e.g. /mfa) │
└─────────┘      │  applySecurity(req,…):    │
                 │  ├─ Rate-Limiter          │
                 │  ├─ WAF Rules             │
                 │  ├─ Auth + RBAC           │
                 │  └─ Security Headers      │
                 └──────────┬────────────────┘
                            │ inserts / updates
                        ┌───▼──────────┐
                        │  rate_limits │   counts per key
                        ├──────────────┤
                        │   waf_logs   │   full attack log
                        └──────────────┘
```

All persistent data lives in Postgres so multiple Edge Function instances share the same view.

---

## 2. Rate Limiting

### 2.1 Default Policies

| Policy key | Window | Limit | Applied to |
|------------|--------|-------|------------|
| `default`  | 60 s   | 60    | All endpoints |
| `auth`     | 60 s   | 10    | `/login`, `/mfa/*`, signup |
| `api`      | 60 s   | 120   | Public JSON APIs |
| `payment`  | 60 s   | 20    | Stripe, payment-intent |
| `admin`    | 60 s   | 300   | Admin dashboards |
| `webhook`  | 60 s   | 120   | Third-party webhooks |

Each Edge Function selects the policy once:

```ts
const res = await applySecurity(req, "payment");      // see _shared/security.ts
```

### 2.2 Storage Schema (`rate_limits`)

```sql
SELECT * FROM rate_limits
ORDER BY last_request_at DESC
LIMIT 5;
```

Columns: `key`, `endpoint`, `count`, `expires_at`, …

Cleanup job (`cleanup_expired_rate_limits()`) runs nightly (see cron comment in migration).

### 2.3 Custom Limits

Override per request:

```ts
await applySecurity(req, {
  rateLimit: { limit: 5, window: 60, ipBased: true, userBased: false },
  waf: false,           // keep WAF default medium
  auth: "optional"
});
```

---

## 3. Web-Application Firewall (WAF)

### 3.1 Protection Levels

| Level      | Rules Enabled                           | Typical Usage                 |
|------------|-----------------------------------------|-------------------------------|
| `LOW`      | Basic SQL-i, XSS, Path-Traversal        | Simple GET endpoints          |
| `MEDIUM`   | + Header, Command-Injection, SSRF       | Most JSON APIs (default)      |
| `HIGH`     | + CSRF, Content-Type validation         | Auth, Payment, MFA            |
| `MAXIMUM`  | + Extra header validations              | Admin & internal tools        |

### 3.2 Log Table (`waf_logs`)

Each detection inserts a row:

```sql
SELECT timestamp, ip_address, rule_id, path, action
FROM waf_logs
ORDER BY timestamp DESC
LIMIT 10;
```

Fields include redacted headers/params.

### 3.3 Overriding

```ts
await applySecurity(req, {
  waf: {         // custom config
    protectionLevel: "HIGH",
    blockMode: true,           // false = log only
    enableLogging: true,
    trustedIps: ["203.0.113.5"]
  },
  rateLimit: "api",
  auth: "required",
  roles: ["admin"]
});
```

Custom regex rules can be added when instantiating the WAF (see `_shared/waf.ts`).

---

## 4. Deployment & Configuration

### 4.1 Prerequisites

```
supabase db push                          # apply 20250721000000_add_security_tables.sql
supabase functions deploy <func> …        # redeploy all Edge Functions
```

### 4.2 Environment Variables

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

No extra keys are required; rate-limiter and WAF share the service-role client.

### 4.3 Migration Verification

```sql
\d+ rate_limits;
\d+ waf_logs;
```

---

## 5. Monitoring & Alerting

1. **Supabase Logs**

   ```bash
   supabase functions logs stripe-webhook --project-ref <proj>
   ```

2. **SQL Dashboards**

   Example: Top attacking IPs in last 24 h

   ```sql
   SELECT * FROM get_recent_attacks_by_ip();
   ```

3. **Rate-Limit Violations**

   ```sql
   SELECT * FROM get_rate_limit_violations();
   ```

4. **External Alerts**

   - Create a scheduled query in Supabase → send Slack if `severity='critical'`.
   - Or connect Postgres → Grafana/Metabase for dashboards.

---

## 6. Best Practices

1. **Least-Privilege** – keep `blockMode=true` for HIGH/MEDIUM, override only when needed.  
2. **Trusted IPs** – whitelist CI/CD or internal cron by `trustedIps`.  
3. **Rotate Secrets** – service role key & env secrets every 90 days.  
4. **Version Pinning** – Edge Functions import Stripe/OTP libraries with explicit versions.  
5. **Log Review** – weekly check `waf_logs` and `rate_limits` for anomalies.  
6. **Staging First** – test new WAF rules in `blockMode=false` before production.  
7. **Performance** – tables are indexed; periodically call `VACUUM ANALYZE waf_logs`.

---

## 7. Troubleshooting

| Symptom | Possible Cause | Resolution |
|---------|----------------|------------|
| 429 “Too Many Requests” seen by legit user | Wrong policy / burst traffic | Raise limit for endpoint, or whitelist user ID |
| 403 “WAF_BLOCK” | Payload matched a rule | Inspect `waf_logs` for `rule_id`; adjust custom rules or lower protection level |
| Edge Function 500 with `security layer error` | Missing env vars | Ensure `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` set in Functions env |
| High `rate_limits` row count | Cleanup job disabled | Run `SELECT cleanup_expired_rate_limits();` and re-enable pg_cron |
| Performance lag on heavy logs | Large `waf_logs` table | Call `cleanup_old_waf_logs(7);` (keeps 7 days) |

---

## 8. Practical End-to-End Example

```
# 1. Deploy (staging)
supabase db push --file supabase/migrations/20250721000000_add_security_tables.sql
supabase functions deploy mfa stripe-webhook --project-ref stage

# 2. Simulate attack (XSS)
curl -X POST "https://stage.functions.supabase.co/mfa/authenticate?name=<script>alert(1)</script>"

# 3. Verify block
# -> HTTP 403
# -> Row in waf_logs with rule_id='xss-001'

# 4. Inspect logs
select rule_id, ip_address, headers->>'user-agent'
from waf_logs
order by timestamp desc
limit 1;
```

---

## 9. Maintenance Checklist

| Frequency | Task |
|-----------|------|
| Daily | Check Cloud Logs for 429 / 403 spikes |
| Weekly | Review `waf_logs` critical entries |
| Monthly | Rotate secrets, run `VACUUM ANALYZE` on `waf_logs` |
| Quarterly | Pen-test staging with OWASP ZAP in log-only mode |
| Yearly | Review rule set against updated OWASP Top 10 |

---

_Stay secure & ship with confidence!_  
Questions? Reach out in **#security-eng** on Slack.
