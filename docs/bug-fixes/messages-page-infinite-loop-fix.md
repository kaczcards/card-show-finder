# Messages Page – Infinite Update Loop Fix  
_File: `src/hooks/useConversationMessagesQuery.ts` (PR # ??)_

---

## 1&nbsp;·&nbsp;Bug Overview  
Opening any conversation in **Messages** crashed the app with:

```
Error: Maximum update depth exceeded.
```

Symptoms:  
* Screen flickered between loading and content state.  
* CPU spiked, React-Native DevTools showed continuous re-render cycles.  
* Logcat pointed to `useConversationMessagesQuery` → `markConversationAsRead()` firing repeatedly.

---

## 2&nbsp;·&nbsp;Technical Root Cause  

| Trigger | Chain reaction |
|---------|----------------|
| `useConversationMessagesQuery` **effect** ran on every render once messages loaded | ⟶ called `messagingService.markConversationAsRead(conversationId, userId)` |
| The service **mutated DB** → Supabase subscription **invalidated** query cache | ⟶ `react-query` refetched messages + conversations |
| New data arrival updated component **state** | ⟶ **effect ran again** → loop |

Because `markConversationAsRead` fired unconditionally whenever `messages` changed, the side-effect re-triggered itself, exhausting React’s update depth.

---

## 3&nbsp;·&nbsp;Solution Implemented  

1. **Idempotent guard**  
   ```ts
   const hasMarkedAsReadRef = useRef<string|null>(null);
   ```
   • Store the conversation id once it is marked.  
   • Bail out of the effect if `hasMarkedAsReadRef.current === conversationId`.

2. **Reset logic when switching chats**  
   ```ts
   if (hasMarkedAsReadRef.current !== conversationId) {
     hasMarkedAsReadRef.current = null;
   }
   ```

3. **Early-exit predicates**  
   – no call when `messages.length === 0`, missing `userId` / `conversationId`, or already marked.

4. **Non-blocking error handling**  
   Console-log failures instead of throwing, preventing a second loop caused by retries.

The hook now executes `markConversationAsRead` **once per conversation per mount**; subsequent cache updates no longer trigger another call, breaking the cycle.

---

## 4&nbsp;·&nbsp;How to Verify the Fix  

1. **Manual QA**  
   1. Launch app, open **Messages**.  
   2. Select a conversation with unread messages.  
   3. Observe:  
      * Messages load instantly, no UI freeze.  
      * Unread badge disappears after ~1 s.  
      * Navigating back and forth does **not** crash the app.

2. **Automated tests** (`jest`)  
   ```bash
   pnpm test src/__tests__/hooks/useConversationMessagesQuery.test.ts
   ```  
   • Ensures `markConversationAsRead` called only once per chat, never during loading, none when `userId` null, etc.

3. **Performance**  
   Attach React-DevTools → “Render count” remains ~1–2 per interaction, not hundreds.

---

## 5&nbsp;·&nbsp;Best Practices Going Forward  

| Principle | Implementation tip |
|-----------|-------------------|
| Avoid side-effects on every render | Use **refs** or state flags to track once-only actions |
| Keep effects narrowly scoped | Include *minimal* dependency arrays; derive values outside effect |
| Guard network calls | Check pre-conditions (ids present, data loaded, not already processed) |
| Watch for cascading cache invalidations | When using React-Query + realtime sources, ensure writes don’t instantly trigger reads that re-fire the same write |
| Unit-test hooks with mocks | Simulate message arrivals, conversation switches, and assert side-effect counts |

---

**Status:** Deployed to production 2025-07-11. No crashes observed in Sentry since rollout.  
