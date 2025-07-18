# Pull Request: Date-Based Review Button Logic for **Show Details**

---

## 1 · Problem Statement  
The Review button (⭐) on the Show Details screen was always visible, letting users submit reviews **before a show had even taken place**.  
This produced:
* “Future” reviews that skewed ratings  
* Confused users (“How can I review a show I haven’t attended yet?”)  
* Extra moderation work to delete invalid feedback  

---

## 2 · Technical Implementation  

### Key Changes  
1. **ShowHeaderActions.tsx**  
   * Added `show` prop (full Show object).  
   * Added `hasShowEnded(show)` helper to decide review visibility.  
   * Review button now renders **only if** `hasShowEnded(show) === true`.

2. **ShowDetailScreen.tsx**  
   * Passes the loaded `show` object down to `ShowHeaderActions`.  

No API, DB, or navigation changes – pure UI logic.

---

## 3 · How `hasShowEnded()` Works  
```ts
const hasShowEnded = (s: Show): boolean => {
  // Prefer endDate; if missing fall back to startDate
  const dateStr = (s.endDate ?? s.startDate) as string | Date;
  if (!dateStr) return false;              // safety-net
  return new Date(dateStr).getTime() < Date.now();
};
```
• **endDate available?** → uses endDate (true “finished” marker).  
• **No endDate?** → falls back to startDate (one-day events).  
• Compares in milliseconds against `Date.now()` to allow review **only after** the timestamp has passed.

---

## 4 · User-Experience Improvements  
* **Prevents invalid reviews** – button is hidden until show is over.  
* **Reduces confusion** – users can’t mistakenly try to review early.  
* **Cleaner interface** – no pointless action for future events.  
* **Consistent behaviour** – every show follows same temporal rule.

---

## 5 · Testing Verification  

| Scenario | Start / End | Expected | Result |
|----------|-------------|----------|--------|
| Past show (ended yesterday) | endDate < now | Button visible | ✅ |
| Past show (only startDate, 1 week ago) | startDate < now | Visible | ✅ |
| Show finishing **today**, 1 hour ago | endDate < now | Visible | ✅ |
| Currently happening (endDate > now) | endDate > now | Hidden | ✅ |
| Upcoming show (starts tomorrow) | startDate > now | Hidden | ✅ |

Console unit tests & simulator checks confirm correct visibility in all cases.

---

## 6 · Benefits  

### Data Integrity  
* Blocks premature ratings → preserves authentic post-show feedback  
* Protects average rating accuracy  

### User Experience  
* Aligns with real-world flow: attend → review  
* Removes dead-end action for upcoming shows  

---

## 7 · Future-Proofing  
* Helper is self-contained – can be exported for reuse in other review entry points.  
* Fallback logic already covers single-day shows lacking `endDate`.  
* If multi-day “ongoing” status UI is added, same helper can be reused with minimal tweaks.  
* No breaking changes; OTA-safe.

---

## 8 · Example Visibility Matrix  

| Show Status | Review Button |
|-------------|---------------|
| Ends **tomorrow** | 🚫 Hidden |
| Starts **today**, ends **tomorrow** | 🚫 Hidden |
| Ended **1 hour ago** | ⭐ Visible |
| Ended **last week** | ⭐ Visible |

---

### ✅ Ready for Review  
This PR prevents invalid reviews while **fully preserving** the ability to rate legitimate past shows, improving both data quality and user trust without affecting any other functionality.  
