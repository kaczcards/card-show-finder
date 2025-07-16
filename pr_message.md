# Fix Password Reset Flow (iOS & Android)

## 🚀 Overview
This PR finishes the **password-reset experience** so users can successfully change their password from the e-mail link on both iOS and Android.

Previously the reset e-mail was sent, but clicking the link opened a blank page because the app did not recognise the deep-link.  
The flow is now end-to-end:

1. User taps **Change Password** in Profile → reset e-mail is sent.  
2. User clicks the link in the e-mail.  
3. The app launches, detects the `token` in the URL and shows **ResetPasswordScreen**.  
4. User enters a new password → Supabase updates the account.  
5. User is routed back to **Login** and can sign-in with the new credentials.

## ✨ Key Changes
| Area | Change |
|------|--------|
| **Auth Service** | • `resetPassword` now sends platform-appropriate `redirectTo` (custom scheme on iOS, universal link on Android).<br>• Added `updatePassword(newPassword, accessToken)` helper. |
| **Deep Linking** | • Added universal-link & custom-scheme prefixes in `RootNavigator`.<br>• Updated **app.config.js** with `associatedDomains` (iOS) & `intentFilters` (Android). |
| **UI / Screens** | • **ResetPasswordScreen** created: token parsing, validation, error states, optional debug log.<br>• **AuthNavigator** registered the new screen. |
| **ProfileScreen** | • “Change Password” button shows loader and calls `resetPassword`. |
| **Developer Tooling** | Debug panel (DEV only) in ResetPasswordScreen to aid QA. |

## 🧪 Testing
1. Build & install the app (`expo run:ios` / `run:android`) **with device e-mail client logged in**.  
2. Navigate to **Profile → Change Password**.  
3. Confirm toast / alert that e-mail was sent.  
4. Open the mail, click the link:  
   * iOS → `cardshowfinder://reset-password?token=…`  
   * Android → `https://cardshowfinder.app/reset-password?token=…`  
5. App opens on **Reset Password** screen; enter & confirm a new password (≥ 8 chars).  
6. Tap **Update Password** – alert shows success and you are returned to **Login**.  
7. Sign-in with the new password ✔️

## 🔍 Edge-Cases Handled
* Missing / expired token shows friendly message & “Request New Reset Link”.
* Links opened while the app is **already running** are handled via `Linking.addEventListener`.
* Invalid URLs are logged (DEV) without crashing the app.

## 📸 Screenshots
*(see attached images in PR)*

---

Ready for review 🙏
