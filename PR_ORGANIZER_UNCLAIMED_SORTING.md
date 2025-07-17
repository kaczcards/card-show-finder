# Pull Request: Chronological Sorting for **Unclaimed Shows & Series** (Organizer View)

---

## 1 · Problem Statement  
The **Unclaimed** list shown to organizers bundled every standalone show and show-series in the order returned by the API.  
This random mix forced organizers to scroll through:

* Past events that no longer matter  
* Future events with far-out dates listed above urgent, near-term shows  

Result: time-sensitive opportunities were buried, slowing down the claiming workflow and risking missed revenue.

---

## 2 · Technical Implementation  

### `sortUnclaimedItems(items: UnclaimedItem[])`
A pure helper created inside `src/components/UnclaimedShowsList.tsx`.

1. **Partition**  
   ```
   const upcoming = items.filter(d => date(d) >= today)
   const past     = items.filter(d => date(d) <  today)
   ```
2. **Sort each bucket**  
   • Upcoming → ascending `date` (closest to today **first**)  
   • Past     → descending `date` (most recently finished **first**)  
3. **Merge**  
   `return [...upcoming, ...past];`

### Date Source per Type  
| Item Type | Date Used for Sort | Rationale |
|-----------|-------------------|-----------|
| `series`  | `nextShowDate`    | Earliest upcoming date within the series |
| `show`    | `startDate`       | Actual event start day |

Both paths fall back to `new Date(0)` if the field is missing, keeping invalid rows at the bottom.

The function is wrapped in `useCallback` for memoisation and applied to **both** pull-to-refresh and initial load:

```tsx
<FlatList
  data={sortUnclaimedItems(unclaimedItems)}
  ...
/>
```

---

## 3 · How the Sorting Works

1. **Upcoming block**  
   • Tomorrow → Next week → Next month …  
2. **Past block** (below upcoming)  
   • Last week → Last month → Older …

Within each block, order is strictly chronological.

---

## 4 · User-Experience Improvements for Organizers

* **Time-critical first** – urgent shows appear at the top of the list  
* **Less scrolling** – past events no longer crowd the viewport  
* **Mental model parity** – mirrors calendar apps, instantly understood  
* **Faster claiming** – reduces risk of missing important events

---

## 5 · Testing Verification

### Console Unit Test
```text
Input order:
• Past Show 1 (–30d)
• Series A (next show +7d)
• Show B (+1d)
• Past Show 2 (–7d)
• Series C (+30d)

Sorted order:
1. Show B (+1d)               [UPCOMING]
2. Series A (+7d)             [UPCOMING]
3. Series C (+30d)            [UPCOMING]
4. Past Show 2 (–7d)          [PAST]
5. Past Show 1 (–30d)         [PAST]
```
Confirmed identical output in simulator.

### Manual QA

| Scenario | Expected | Result |
|----------|----------|--------|
| Only future items | Ascending soonest→latest | ✅ |
| Only past items | Descending most-recent→oldest | ✅ |
| Mixed items | Upcoming block first | ✅ |
| Pull-to-refresh | List re-sorted | ✅ |
| Claim item | Item disappears, list re-sorted | ✅ |

---

## 6 · Workflow & Time-Management Benefits

* **Prioritisation** – Organizers tackle shows in chronological urgency  
* **Reduced cognitive load** – clearly separated sections clarify context  
* **Higher conversion** – by surfacing near-term events, claiming happens sooner  
* **Scalable** – handles any volume without degrading discoverability

---

## 7 · Future-Proofing

* Helper is **pure** & **generic** – movable to `utils/` for reuse.  
* Works with pagination; apply after each fetch chunk.  
* Graceful fallback if `endDate`/`nextShowDate` missing.  
* No API, DB, or schema changes – UI-only enhancement, safe for OTA.

---

## 8 · Before / After Snapshot

|   | **Before** | **After** |
|---|------------|-----------|
| 1 | Past Show (Feb) | **Tomorrow’s Show** |
| 2 | Series (Dec) | **Next-Week Series** |
| 3 | Tomorrow’s Show | Series (Dec) |
| 4 | … | **Past Show (Last Week)** |
| 5 | … | Past Show (Feb) |

> **Result:** time-sensitive, unclaimed shows jump to the top for immediate action.

---

### ✅ Ready for Review  
This PR brings critical chronological clarity to the organizer’s Unclaimed list, spotlighting the shows and series that need attention **right now**, and relegating historical data to the bottom.  
