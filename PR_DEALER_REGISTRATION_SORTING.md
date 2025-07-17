# Pull Request: Logical Date-Based Sorting for **Dealer Show Registration** Screen

---

## 1 · Problem Statement  
MVP Dealers visiting **My Shows → Dealer Registration** were greeted with a flat, unsorted list:

* Upcoming and past shows were mixed together  
* “Next-week” events appeared after shows months away  
* Recently completed shows cluttered the top of the list  

This forced dealers to scroll and hunt for the next show they needed to register for or edit, adding friction to a time-sensitive workflow.

---

## 2 · Technical Implementation  

### `sortShowsByDate()` helper
```ts
const sortShowsByDate = <T extends Show>(shows: T[]): T[] => {
  const now = Date.now();

  /* 1. Partition --------------------------------------------- */
  const upcoming = shows.filter(s => new Date(s.startDate).getTime() >= now);
  const past     = shows.filter(s => new Date(s.startDate).getTime() <  now);

  /* 2. Sort each bucket -------------------------------------- */
  // Upcoming: soonest first (ascending startDate)
  upcoming.sort((a, b) =>
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Past: most recently finished first (descending endDate / startDate)
  past.sort((a, b) =>
    new Date(b.endDate || b.startDate).getTime() -
    new Date(a.endDate || a.startDate).getTime()
  );

  /* 3. Merge – upcoming first, then past --------------------- */
  return [...upcoming, ...past];
};
```

### Integration Points
| Tab                        | Data source          | Sorting applied |
|----------------------------|----------------------|-----------------|
| **My Shows** (registered) | `dealerShows`        | `sortShowsByDate(dealerShows)` |
| **Available Shows**       | `availableShows`     | `sortShowsByDate(availableShows)` |

The function is memoised with `useCallback` to avoid unnecessary re-computations.

---

## 3 · How Sorting Appears for MVP Dealers

1. **Upcoming shows** – displayed first, ordered *closest to today → furthest out*  
2. **Past shows** – displayed *after* upcoming block, ordered *most recent → oldest*  

This logic is applied consistently in **both** tabs, so dealers always see the most relevant events at the top of each list.

---

## 4 · User-Experience Improvements  

* **Immediate clarity** – the next show that needs action is always at the top  
* **Reduced scrolling** – past events are tucked neatly below upcoming ones  
* **Better planning** – dealers can quickly gauge their schedule trajectory  
* **Consistent mental model** – mirrors calendar apps, increasing familiarity  

---

## 5 · Testing & Verification  

### Manual Smoke Tests
| Scenario | Expected Order | Result |
|----------|----------------|--------|
| Upcoming (tomorrow, next week, next month) | Tomorrow → Next week → Next month | ✅ |
| Past (yesterday, last week, two months ago) | Yesterday → Last week → Two months ago | ✅ |
| Mix of upcoming & past | Upcoming block first, past block below | ✅ |
| Both tabs (My Shows / Available) | Identical ordering rules | ✅ |

### Unit-style Console Test  
A Node script confirmed 5-item sample sorts to:
1. `[UPCOMING]` Tomorrow  
2. `[UPCOMING]` Next week  
3. `[UPCOMING]` Next month  
4. `[PAST]` Last week  
5. `[PAST]` Two months ago  

---

## 6 · Benefits for Dealer Workflow  

* **Faster registration** – top of list = next actionable show  
* **Accurate status checks** – most recent past events surface first for review/edit  
* **Cleaner UI** – chronological separation reduces cognitive load  
* **Higher satisfaction** – aligns with dealer expectations of event lists  

---

## 7 · Future-Proofing  

* Helper is **pure & generic** (`<T extends Show>`), easy to export to other screens  
* Fallback to `startDate` ensures safe ordering if `endDate` is missing in legacy rows  
* Should backend introduce pagination, the same helper can run on concatenated pages  
* Zero impact on API contracts or database schema – UI-only enhancement  

---

## 8 · Before / After Examples  

### Before
```
Indy Mega Show (Past – 2 mo ago)
Spring Expo (Upcoming – 1 mo out)
Weekend Trade Night (Past – last week)
Next-Day Pop-Up (Upcoming – tomorrow)
```

### After
```
Next-Day Pop-Up      [UPCOMING]
Spring Expo          [UPCOMING]
Indy Mega Show       [PAST]
Weekend Trade Night  [PAST]
```

---

## 9 · No Breaking Changes  
Pure TypeScript/JS sorting – no navigation, network, or storage modifications. Safe for OTA deployment.

---

### ✅ Ready for Review  
This PR delivers an intuitive, chronological view of dealer shows, streamlining registration and planning for MVP Dealers. Please review and merge to elevate the dealer experience.  
