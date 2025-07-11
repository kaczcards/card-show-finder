# Messages Page Crash – Final Root-Cause Fix  
_File: `src/screens/Messages/DirectMessagesScreen.tsx`_  
_Date fixed: 2025-07-11_

---

## 1 · Real Root Cause

The **“Maximum update depth exceeded”** error was triggered by an **infinite re-render loop** between **`DirectMessagesScreen`** and **`ChatList`**:

| Step | What happened |
|------|---------------|
| 1 | `DirectMessagesScreen` renders and **creates new function props** (`handleSelectConversation`, `handleCreateNewConversation`). |
| 2 | Because the props’ **identity changes each render**, React treats them as *new* → `ChatList` re-renders. |
| 3 | `ChatList` state/effects fire → indirectly update parent state or navigation. |
| 4 | Parent re-renders again → **functions recreated** → loop resumes.<br>Eventually React throws `Maximum update depth exceeded`. |

The functions were declared inline, **outside of `useCallback`**, so their references were unstable.

---

## 2 · Why Previous Patches Failed

Earlier attempts:

1. Added `useRef` guards **inside child hooks/components** (`ChatList`, `useConversationMessagesQuery`).
2. Removed items from `useEffect` dependency arrays.

These mitigated some secondary loops but **never addressed the fundamental prop instability**.  
As long as `DirectMessagesScreen` kept recreating the callbacks each render, the feedback-loop persisted.

---

## 3 · How `useCallback` Fixes the Issue

`useCallback(fn, deps)` returns a **memoised** function whose reference remains **stable** until one of `deps` changes.

Benefits here:

* `ChatList` receives **identical** function references on subsequent renders → React’s prop diffing detects *no change* → component **does not re-render** needlessly.
* Side-effects inside `ChatList` that depend on those callbacks stop firing repeatedly.

---

## 4 · Implemented Solution

```tsx
// src/screens/Messages/DirectMessagesScreen.tsx
import React, { useCallback } from 'react';

...

// NEW – wrapped in useCallback with *stable* dep arrays
const handleCreateNewConversation = useCallback(() => {
  setShowNewConversation(true);
}, []);

const handleSelectConversation = useCallback(
  (conversation: Conversation) => {
    // update header title only
    const other = conversation.participants?.[0];
    navigation.setOptions({
      title: other?.display_name || 'Conversation',
    });
  },
  [navigation]               // updates *only* if navigation ref changes
);

return (
  <ChatList
    userId={user?.id}
    onSelectConversation={handleSelectConversation}
    onCreateNewConversation={handleCreateNewConversation}
    initialConversationId={initialConversationId}
  />
);
```

Key points  
* **No inline functions** in JSX.  
* `handleCreateNewConversation` has **empty dependency array** ⇒ one stable instance for component lifetime.  
* `handleSelectConversation` depends solely on `navigation`; if that reference changes React correctly recreates the callback.

---

## 5 · Verifying the Fix

1. **Manual QA**  
   1. Launch app → open **Messages** tab.  
   2. Screen loads, *no red error screen*, conversations visible.  
   3. Navigate back & forth; deep-link into a conversation; still no crash.

2. **Automated Tests** (`jest`)  
   * `__tests__/screens/Messages/DirectMessagesScreen.test.tsx` asserts that the callback props **maintain referential equality** between renders, proving they’re memoised.

3. **Performance Check**  
   * In React DevTools → highlight updates. Only intended components flash, frame rate steady.

---

## 6 · Preventing Similar Bugs

| Guideline | Reason |
|-----------|--------|
| Wrap all callback props with **`useCallback`** | Prevents unnecessary child renders & loops. |
| Avoid creating **inline objects/arrays** in JSX | Same identity-change issue as functions. |
| Monitor render counts in DevTools | Early detection of runaway re-renders. |
| Add **unit tests** asserting prop stability | Guards against regressions. |
| Keep effects’ dependency arrays minimal | Pair with stable inputs to avoid thrashing. |

Following these practices ensures component trees stay *pure* and performant, eliminating accidental infinite update loops.
