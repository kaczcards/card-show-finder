# Pull Request: Implement Logical Date-Based Sorting on **My Shows** Page

---

## 1 · Problem Statement  
The *My Shows* screen previously displayed **unsorted arrays** of upcoming and past shows.  
Users had to hunt for the next show they were attending, or scroll past old events to find a recent one. This lack of ordering:

* Reduced the usefulness of the list for planning
* Forced unnecessary scrolling / cognitive load
* Made the page feel unfinished and inconsistent with expectations found in calendar-style apps

---

## 2 · Technical Implementation  

### 2.1 Helper Functions  
```ts
// Sort earliest → latest (soonest first)
const sortUpcomingShows = (shows: Show[]) =>
  [...shows].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

// Sort latest → earliest (most recently finished first)
const sortPastShows = (shows: Show[]) =>
  [...shows].sort(
    (a, b) =>
      new Date(b.endDate || b.startDate).getTime() -
      new Date(a.endDate || a.startDate).getTime()
  );
```

* Upcoming list uses **startDate** (time to go).  
* Past list uses **endDate**; if endDate missing, falls back to startDate so legacy rows still order correctly.  
* Both helpers copy the array before sorting, preserving immutability.

### 2.2 Integration  
`FlatList` now receives a **freshly-sorted array** on every render:

```tsx
data={
  currentTab === 'upcoming'
    ? sortUpcomingShows(upcomingShows)
    : sortPastShows(pastShows)
}
```

Any CRUD operation (e.g., remove upcoming) immediately re-sorts without additional state.

---

## 3 · How Sorting Works

| Tab | Sort Key | Order |
|-----|----------|-------|
| Upcoming | `startDate` | Soonest → Farthest |
| Past Shows | `endDate` (fallback `startDate`) | Most Recent → Oldest |

---

## 4 · Updated Dummy Data  
Sample shows were given staggered dates (tomorrow, next week, 2 weeks, 1 month, etc.) and out-of-order IDs.  
This showcases the algorithm in development builds and prevents “already-sorted” illusions.

---

## 5 · User-Experience Improvements  

* **At-a-glance clarity** – the next event is always at the top.  
* **Reduced scrolling** – yesterday’s show appears first in Past list for quick reviews.  
* **Consistency** – mirrors calendar / ticketing apps’ natural order, increasing familiarity.  
* **Trust** – feels intentional rather than random.

---

## 6 · Testing Considerations  

### Manual QA  
1. Switch between **Upcoming / Past** tabs  
   * Verify chronological ordering as defined above.  
2. Remove an upcoming show  
   * Remaining list re-sorts correctly.  
3. Add a new dummy show with a nearer date  
   * Appears at top of Upcoming.  
4. Toggle device locale & timezone  
   * Ordering remains correct (UTC offset handled by JS `Date`).  

### Automated (future)  
* Unit tests comparing helper output for given arrays/dates.  
* Snapshot test to ensure order after state mutation.

---

## 7 · Future-Proofing for Real Data Integration  

* **Pure functions** accept any `Show[]` → drop-in replacement once API provides real data.  
* End-date fallback guards against partially populated rows from older DB records.  
* Helpers live alongside screen component; can be extracted to shared utils when other pages require similar logic.

---

## 8 · Before / After Examples  

### Upcoming (unsorted)  
| Original Order | Date |
|----------------|------|
| Indy Card Expo | Tomorrow |
| Pacific Rim Collectors Fest | +1 Month |
| Midwest Trade Night | +1 Week |
| Great Lakes Sports Show | +2 Weeks |

### Upcoming (after patch)  
| **New Order** | Date |
|---------------|------|
| Indy Card Expo | Tomorrow |
| Midwest Trade Night | +1 Week |
| Great Lakes Sports Show | +2 Weeks |
| Pacific Rim Collectors Fest | +1 Month |

### Past Shows (after patch)  
| **New Order** | Date |
|---------------|------|
| East Coast Card Show | Yesterday |
| Lone Star Card Bash | 5 Days Ago |
| Sunbelt Sports Collectibles | 1 Week Ago |
| Rocky Mountain Card Convention | 1 Month Ago |

---

## 9 · No Breaking Changes  

* UI-only logic; no backend, navigation or schema modifications.  
* Safe for OTA release; rollback is simply reverting this commit.

---

### ✅ Ready for Review  
This PR transforms *My Shows* into a practical planning and history tool by ordering items relative to **today’s date**. Please review and merge to give users the intuitive experience they expect.
