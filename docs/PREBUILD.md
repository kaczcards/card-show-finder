# Expo Prebuild Guide

This repo relies on **Expo Prebuild** to generate the native *iOS* and *Android* folders that Xcode/Gradle need.  
Use this guide whenever you see errors like _“ios directory missing”_ or _“Git branch has uncommitted file changes”_.

---

## 1  What “prebuild” does & why we need it
• Converts `app.config.js`, `package.json` and other JS/TS settings into native projects.  
• Creates / refreshes `ios/` and `android/` directories (Xcode project, `Podfile`, Gradle files…).  
• Ensures native dependencies are linked correctly (CocoaPods, Gradle Maven).  
• Must be rerun every time you add/remove native modules **or** tweak `app.config.js`.

---

## 2  The environment-variable problem (and the fix)
Problem   `app.config.js` validates critical env vars (e.g. `EXPO_PUBLIC_SUPABASE_URL`).  
In non-interactive shells (CI or GitHub Actions) the variables were **not** exported, so prebuild printed warnings and exited with `1`.

Solution   We added:

1. `scripts/prebuild.sh` – loads **all** variables from `.env` using `set -a && source .env`.  
2. NPM helpers (`prebuild:*`) that call the script.

Result  Prebuild now sees the variables locally *and* in CI/CD.

---

## 3  Using the NPM scripts

| Script                     | What it does                               |
|----------------------------|--------------------------------------------|
| `npm run prebuild:ios`     | Prebuild only iOS                          |
| `npm run prebuild:android` | Prebuild only Android                      |
| `npm run prebuild:both`    | Sequentially prebuild iOS **then** Android |
| Add `:clean` suffix        | Wipes existing native folders first        |

Examples  
    # Clean + regenerate iOS project
    npm run prebuild:ios:clean

    # Regular prebuild for both platforms
    npm run prebuild:both

---

## 4  Running the shell script directly

Inside the repo root:

    ./scripts/prebuild.sh ios            # iOS only
    ./scripts/prebuild.sh android --clean
    ./scripts/prebuild.sh both --clean   # iOS + Android, fresh

Arguments  
• `ios`, `android`, `both` – platform selector (required)  
• `--clean` (optional)     – delete `ios/` &/or `android/` first

---

## 5  Troubleshooting

| Symptom                                                      | Fix                                                                |
|--------------------------------------------------------------|--------------------------------------------------------------------|
| _“Missing environment variable …”_                           | Ensure the key is in `.env` **and** starts with `EXPO_PUBLIC_`     |
| _“Git branch has uncommitted file changes”_ during prebuild  | `git add . && git commit -m "wip"` **or** pass `--clean`           |
| CocoaPods step skipped on macOS                              | Make sure Xcode command-line tools are installed (`xcode-select`) |
| Build fails in CI                                            | Use `npm run prebuild:both --if-present` before `eas build`        |
| Android build complains about namespace/package              | Run `npm run prebuild:android:clean` to regenerate Gradle configs  |
| _“Missing environment variable …” **warning** while running_ `expo prebuild` | Normal during **local** runs – see explanation below               |

---

### Why you may still see “Missing environment variable …” warnings

When you execute any `expo *` command, **Expo evaluates `app.config.js` immediately**.  
Our `scripts/prebuild.sh` loads `.env` _after_ that evaluation step, so `app.config.js` doesn’t see the
variables yet and prints warnings such as:

```
[app.config.js] Missing environment variable: EXPO_PUBLIC_SUPABASE_URL
```

During **local development** these warnings are harmless – the shell script finishes loading the
variables _before_ the actual prebuild work begins, so the native projects are generated with the
correct values.  
If you want to verify, run:

```bash
npm run prebuild:ios:clean && echo $EXPO_PUBLIC_SUPABASE_URL
```

You’ll see the variable is present even though the warning appeared earlier.

## 6  Usage scenarios

### Local development
    # 1. Install deps
    pnpm i            # or npm/yarn

    # 2. Generate native code
    npm run prebuild:ios     # or :android / :both

    # 3. Run app
    npx expo run:ios

### Clean rebuild after adding a native module
    npm run prebuild:both:clean

### GitHub Actions / CI
    - name: Prebuild native projects
      run: npm run prebuild:both --if-present

    # Proceed with `eas build -p ios` or `eas build -p android`

---

**Tip:** Keep your `.env` **out of git** (it’s already in `.gitignore`) and supply the same variables as repository secrets for CI jobs.
