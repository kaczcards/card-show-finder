# Messages Page – Infinite Render Loop **(Fix v2)**  
_File: `src/components/Chat/ChatList.tsx` – merged 2025-07-11_

---

## 1 · What *really* caused the loop?

`ChatList` contains an effect that auto-selects a conversation when the screen is opened via a deep-link:

```ts
useEffect(() => {
  if (initialConversationId && conversations.length > 0 && !selectedConversation) {
    const convo = conversations.find(c => c.id === initialConversationId);
    if (convo) handleSelectConversation(convo);
  }
}, [initialConversationId, conversations, selectedConversation]);
```

1. `handleSelectConversation` sets `selectedConversation` **state**.  
2. This triggers a re-render.  
3. Because `selectedConversation` is still in the dependency array the effect fires again → calls `handleSelectConversation` again → **infinite loop** → React throws  

```
Warning: Maximum update depth exceeded.
```

Any time `ChatList` was opened with `initialConversationId` the crash was inevitable.

---

## 2 · Why the *first* patch failed

The initial patch added a `useRef` guard **inside another hook** (`useConversationMessagesQuery`) – but the render loop originates *before* that hook is even mounted.  
As long as `selectedConversation` remained in the dependency list the guard never executed early enough, so the loop persisted.

---

## 3 · Final Solution (v2)

```ts
// NEW — at top of component
const processedInitialIdRef = useRef<string | null>(null);

useEffect(() => {
  if (
    initialConversationId &&
    conversations.length > 0 &&
    processedInitialIdRef.current !== initialConversationId
  ) {
    const convo = conversations.find(c => c.id === initialConversationId);
    if (convo) {
      handleSelectConversation(convo);
      // remember that we have processed this id
      processedInitialIdRef.current = initialConversationId;
    }
  }
}, [initialConversationId, conversations]);
```

Key points  
| Change | Purpose |
|--------|---------|
| **Removed `selectedConversation` from deps** | Prevents effect from re-running when state updates. |
| **`processedInitialIdRef`** | Guarantees the block executes **once per unique `initialConversationId`**. |

No other logic changed; the component still honours deep-links and unread-badge behaviour.

---

## 4 · How this stops the cycle

1. On first render the ref is `null` → effect runs → selects conversation.  
2. `processedInitialIdRef.current` is immediately set to the processed id.  
3. The subsequent state update re-renders `ChatList`, **but** the guard now fails (`processedInitialIdRef.current === initialConversationId`) so the effect exits early.  
4. Render count stabilises at ~2 instead of unbounded growth – loop broken.

---

## 5 · Verifying the Fix

### Manual QA
1. Build / reload the app.  
2. Tap **Messages** tab – screen must load without red box.  
3. Open from push-notification or deep-link:  
   `myapp://messages?conversationId=abc-123` → targeted chat opens, no crash.  
4. Navigate back ⇄ forth multiple times – still stable.

### Automated Tests  
`pnpm test __tests__/components/Chat/ChatList.test.tsx`

✔ Ensures `markConversationAsRead` (and therefore state change) fires **once** per conversation – confirms no infinite effect calls.

---

✅  Crash eliminated, Messages page runs smoothly on both iOS & Android.
