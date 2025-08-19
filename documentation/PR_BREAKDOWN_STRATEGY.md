# PR Breakdown Strategy for `Feature/complete cicd pipeline` (PR #192)

## 1. Current State of PR #192

* Size: **500+ file changes** touching workflows, core services, types, and early-stage messaging UI.
* Scope creep: attempts to solve CI/CD, security scans, TypeScript errors **and** deliver a new messaging system.
* Result: CI pipeline is red, reviewers cannot isolate concerns, and risk of rollback is high.

Why a breakdown is required:

1. Review fatigue – difficult to provide meaningful feedback on unrelated areas.
2. Blocking business value – urgent fixes (CI green, subscription flows, map filters) are held hostage by unfinished messaging work.
3. Higher merge-conflict probability the longer it stays open.
4. Security & compliance tooling (Gitleaks, detect-secrets, CodeQL) must be unblocked before new feature work.

---

## 2. Issues Observed in CI Failures

| Area | Example Error | Root Cause |
|------|---------------|-----------|
| TypeScript | `TS2345: string \| Date \| null` | Nullable types not accounted for in showService refactor. |
| Lint / ESLint | `Cannot find module 'eslint-plugin-security'` | Missing devDependency + outdated workflow step. |
| Secrets Scan | `Invalid path: .secrets.baseline` | Baseline file absent in repo. |
| GitHub Actions | “deprecated version of actions/upload-artifact v3” | Old major tags need upgrade to `@v4`. |
| Database tests | Jobs fail because `upload-artifact@v3` blocked the whole workflow. |
| Messaging imports | Disabled components still referenced in hooks causing TS errors. |

---

## 3. High-Level Breakdown Strategy

1. **Stabilisation Track** (green build):
   * Restore CI, lint, type-check, unit tests.
   * No functional scope changes.
2. **Infrastructure Track**:
   * Migrate all workflows to maintained action versions (`@v4`).
   * Add `.secrets.baseline` + minimal suppression file.
3. **Feature Tracks** (independent PRs):
   * a. Map / Show service fixes (date, location).
   * b. Subscription & Stripe enhancements.
   * c. Misc UI polish.
4. **Messaging Track (deferred)**:
   * Entire messaging feature moved to `disabled-features/`.
   * New branch `feature/messaging-v1` created off `develop` for future work.

Each PR should:

* Touch a bounded surface (≤30 files, ideally <500 LOC).
* Contain its own migration guide if database scripts are included.
* Pass CI before merge.

---

## 4. Plan for Messaging Feature Deferral

1. **Physical isolation**  
   * All messaging UI, hooks, services, tests moved to `disabled-features/`.
   * `tsconfig.json` `exclude` array updated to skip these paths.
2. **Import stubs**  
   * Temporary placeholder types (`type Conversation = any`) and UI (`FeatureComingSoon`) added where messaging components were previously imported.
3. **Feature flag**  
   * `useFeatureFlag('messaging_enabled')` already exists – keep default **false** on prod/staging.
4. **Roadmap**  
   * Re-enable in a dedicated future sprint once CI is stable and schema finalised.
   * Messaging team to maintain a separate PR stack rebased regularly on `develop`.

---

## 5. Priority Order for the New PRs

| Priority | Track | Branch / PR title | Goal |
|----------|-------|-------------------|------|
| P0 | *Stabilisation* | `chore/ci-green-build` | Fix TypeScript, lint, tests; baseline secrets file. |
| P0 | *Infrastructure* | `ci/update-actions-v4` | Upgrade GitHub Actions and remove deprecated versions. |
| P1 | *Infrastructure* | `ci/improve-security-scans` | Integrate detect-secrets baseline and OWASP dependency-check. |
| P1 | *Feature* | `fix/show-service-types` | Resolve nullable date, count(), ignoreDuplicates etc. |
| P2 | *Feature* | `feature/subscription-enhancements` | Stripe webhook tables & Supabase RPC updates. |
| P2 | *Feature* | `ui/map-performance-fixes` | Cluster rendering + filter chips refactor. |
| P3 | *Messaging* | `feature/messaging-v1` (draft) | Incremental messaging implementation gated behind flag. |

---

## 6. Messaging Components Moved to `disabled-features/`

* **components/**
  * `Chat-future/` (ChatList, ChatWindow, MessageBubble, etc.)
  * `GroupMessageComposer.tsx`
  * `MessageButton.tsx`
  * `MessageList.tsx`
  * `MessageDetail.tsx`
* **hooks/**
  * `useConversationMessagesQuery.ts`
  * `useConversationsQuery.ts`
* **screens/Messages/**
  * `DirectMessagesScreen.tsx`
  * `MessagesScreen.tsx`
* **services/**
  * `messagingService.ts`
* **__tests__** folders mirroring the above.
* tsconfig `exclude` paths added for the above directories.

---

## 7. Immediate Next Steps

| Owner | Action | ETA |
|-------|--------|-----|
| Dev Lead | Create branch `chore/ci-green-build` from current PR head. | **Today** |
| Dev Lead | Delete messaging imports from `src/hooks/index.ts`, confirm no unresolved symbols. | Today |
| Backend | Patch `showService.ts` nullable handling & `count()` typings. | Tomorrow |
| DevOps | Commit `.secrets.baseline` (template generated) to unblock detect-secrets. | Tomorrow |
| DevOps | Update all workflow YMLs to `actions/*@v4`, fix ESLint plugin install step. | Tomorrow |
| QA | Verify green build on fork, then close PR #192 and open new smaller PRs per plan. | End of week |
| PM | Update project board with new PR checklist & assign reviewers. | End of week |

**Definition of Done for “green build” PR**

1. `npm run lint`, `npm run typecheck`, `npm test`, database tests all pass locally.
2. GitHub CI shows ✔ for: Lint & Type Check, Unit Tests, Database Tests.
3. Security workflow completes with **success or only warnings**.
4. No messaging code referenced in production bundles.

Once the stabilisation PR merges to `develop`, subsequent focused PRs can be raised in the priority order above.
