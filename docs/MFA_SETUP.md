# Multi-Factor Authentication (MFA) – Setup & Operational Guide  
Card Show Finder  
_Last updated: 2025-07-20_

---

## 0 · Why MFA?

Multi-Factor Authentication (MFA) requires **two or more proofs of identity** before a user is granted access.  
Instead of relying solely on **something you know** (password or magic-link email) we add **something you have** (a Time-based One-Time Password – TOTP – from Google Authenticator, Authy, etc.).

Benefits for Card Show Finder:

* Blocks >99 % of account-takeover attacks caused by leaked credentials  
* Protects high-value roles (MVP Dealer, Show Organizer) and payment flows  
* Adds an auditable layer of security without major UX friction (codes every 30 s)

---

## 1 · Architecture Overview

```
┌────────────┐     enroll/verify     ┌────────────────────────┐
│  Mobile App│  ───────────────────▶ │  Supabase Edge Func.   │
│ (React Expo)│                      │   /functions/mfa       │
└────────────┘◀──────────────────────└────────────────────────┘
       ▲   authenticate/validate-recovery  │
       │                                   ▼
       │                              ┌──────────────┐
       │                              │ PostgreSQL DB │
       │   session token              │  profiles     │
       └──────────────────────────────│  authenticator│
                                       │  recovery    │
                                       └──────────────┘
```

Key components  
• `authenticator_enrollments` – encrypted TOTP secrets  
• `recovery_codes` – hashed backup codes  
• `mfa_challenges` – short-lived challenges during setup  
• Edge Function `mfa` – all API endpoints  
• `mfaService.ts` – client helper

---

## 2 · Server-Side Setup & Deployment

### 2.1 Prerequisites

| Requirement | Version / Notes |
|-------------|-----------------|
| Supabase CLI | ≥ **1.162.0** |
| pgcrypto     | Enabled by default on Supabase |
| MFA encryption key | 32-byte random string (`openssl rand -base64 32`) |

### 2.2 Run the migration

```bash
supabase db push \
  --file supabase/migrations/20250720000000_add_mfa_support.sql
```

Verify:

```sql
\d+ authenticator_enrollments
\d+ recovery_codes
```

### 2.3 Add environment variables

Supabase Dashboard → Project Settings → Functions → **Environment Variables**

```
MFA_ENCRYPTION_KEY=<your 32-byte secret>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # already present
SUPABASE_URL=https://<project-ref>.supabase.co
```

### 2.4 Deploy the Edge Function

```bash
supabase functions deploy mfa --project-ref <project-ref>
```

Expected output:

```
✔ Deployed mfa v1
https://<project-ref>.functions.supabase.co/mfa
```

### 2.5 Test smoke

```bash
curl -X OPTIONS https://<proj>.functions.supabase.co/mfa
# → "ok"
```

---

## 3 · Client Integration (React Native / Expo)

1. **Install dependencies** (QRCode, OTP input UI, etc.)  
   ```bash
   expo install react-native-qrcode-svg
   npm i otpauth@latest
   ```

2. **Import the service**

   ```ts
   import { mfaService } from "@/services/mfaService";
   ```

3. **Enrollment flow**

   ```ts
   const enrol = await mfaService.startEnrollment();
   // Show enrol.qrCode in <QRCodeSVG> for user to scan
   // After user enters 6-digit code:
   const result = await mfaService.verifySetup(code, enrol.challengeId);
   alert(`Backup codes:\n${result.recoveryCodes.join("\n")}`);
   ```

4. **Login flow**

   • After Supabase returns a valid session, call:

   ```ts
   const needsMFA = await mfaService.isMFARequired(user.id);
   if (needsMFA) {
     // prompt for 6-digit code
     await mfaService.authenticate(code, user.id);
   }
   ```

5. **Settings screen**

   • Display status with `mfaService.getMFAStatus()`  
   • Offer regenerate / disable options

_All requests require `Authorization: Bearer <access_token>` header; `mfaService` takes care of this._

---

## 4 · Testing & Verification Checklist

| Scenario | Steps | Expected |
|----------|-------|----------|
| **Enroll & verify** | 1. Start enrollment → scan QR  2. Enter correct 6-digit code | `profiles.mfa_enabled = true`, 10 recovery codes inserted |
| **Login with MFA** | Sign-in → App prompts code → enter code | 200 OK, access continues |
| **Invalid code** | Enter wrong TOTP | 400 error, `mfa_login_attempts.successful=false` |
| **Rate-limit** | 6 wrong codes within 1 h | 429 error until window resets |
| **Recovery code** | Use unused backup code | Marked `used=true`, login succeeds |
| **Disable MFA** | Settings → disable + correct TOTP | `mfa_enabled=false`, tables cleaned |

Use `SELECT * FROM mfa_login_attempts ORDER BY created_at DESC` to audit.

---

## 5 · Security Considerations & Best Practices

1. **Encryption at rest** – TOTP secrets AES-GCM-encrypted with `MFA_ENCRYPTION_KEY`.  
2. **Hashing** – Recovery codes stored as SHA-256 hashes, never in plaintext.  
3. **Rate limiting** – `mfa_login_attempts`+ RPC limit brute-force to 5/ hr per user/IP.  
4. **RLS** – All MFA tables protected; service-role functions only accessible to Edge Function.  
5. **Backup codes** – Shown **once** immediately after verification; instruct users to store securely.  
6. **Key rotation** – Rotate `MFA_ENCRYPTION_KEY` yearly (run re-encryption script).  
7. **Admin bypass** – Only `profiles.role='admin'` may disable MFA without code (support channel).  
8. **Logging & Alerting** – Forward `mfa_login_attempts.successful=false` to Sentry/Slack.

---

## 6 · Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `401 Unauthorized` on `/mfa/enroll` | Missing `Authorization` header | Ensure user is logged-in and pass session token |
| QR code scans but codes always “invalid” | Device time skew | Enable automatic time on phone or allow ±1 min window |
| `429 Too many failed attempts` | Rate-limit exceeded | Wait 1 hour or clear entries in `mfa_login_attempts` (admin) |
| Recovery code says “invalid” | Already used / typo / extra spaces | Use fresh code, strip whitespace |
| Function logs: `MFA_ENCRYPTION_KEY not set` | Secret missing in env | Add key in dashboard + redeploy function |
| Cannot deploy Edge Function | Supabase CLI outdated | `npm i -g supabase@latest` |

View real-time logs:

```bash
supabase functions logs mfa --project-ref <project-ref>
```

---

## 7 · Maintenance Checklist

| Frequency | Task |
|-----------|------|
| Weekly | Review `mfa_login_attempts` for suspicious activity |
| Monthly | Trigger self-test: enroll dummy user, verify login |
| Quarterly | Rotate recovery codes for admin accounts |
| Yearly | Rotate `MFA_ENCRYPTION_KEY`, re-encrypt secrets |

---

### You’re protected! 🎉  
MFA is now live, adding a strong second layer of defense to every Card Show Finder account.  
Questions? Ping `#security` channel on Slack. 