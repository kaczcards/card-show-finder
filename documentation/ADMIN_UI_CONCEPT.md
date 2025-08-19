# Admin “God Mode” UI – Design Concept  
File: `ADMIN_UI_CONCEPT.md`

---

## 1. Purpose & UX Goals
The admin interface is a **single-page control center** that lets trusted admins:

1. Review newly scraped shows before they go live.  
2. Edit / correct data quickly.  
3. Approve or reject with one click and short notes.  
4. Monitor scraper health & tweak source priorities.  
5. See analytics that guide expansion (success %, error streaks).

The UI should feel **fast**, **table-oriented**, with inline editing and keyboard shortcuts; mobile-friendly but optimized for tablet / web view inside Expo.

---

## 2. Main Screens / Views

| Screen ID | Title | Core Components |
|-----------|-------|-----------------|
| `PendingQueue` | Pending Shows | Table list + detail drawer |
| `ShowDetail`   | Pending Show Detail | Form with tabs (Raw • Normalized • Map) |
| `SourceManager`| Scraping Sources | Table with priority sliders & enable toggles |
| `Analytics`    | Scraper Analytics | Charts & KPIs |
| `Settings`     | Admin Settings (keys, schedules) | Simple list + toggles |

---

### 2.1 Navigation Layout
```
┌───────────────────────────┐
│  ☰  Card Show Finder ▸ Admin
├───────────────────────────┤
│ • Pending Queue  (badge)  │
│ • Source Manager          │
│ • Analytics               │
│ • Settings                │
└───────────────────────────┘
```
Hamburger drawer (Expo’s `Drawer.Navigator`) or a small top tabs bar on larger screens.

---

## 3. Key Workflows

### 3.1 Review ➜ Approve / Reject
1. Admin selects **Pending Queue**.  
2. Table lists newest scraped rows (status=PENDING).  
3. Click row → **ShowDetail drawer** slides in.  
4. Tabs: *Raw JSON*, *Normalized (editable)*, *Map Preview*.  
5. Buttons: **Approve**, **Reject**, **Save Edits**.  
6. On approve:
   * PUT `/approve/:id`  
   * Show disappears from queue, toast “Published 🟢”.  
7. On reject:
   * Modal asks for reason → `/reject/:id`  

### 3.2 Edit Show
* In *Normalized* tab every field is a `TextInput` / `DatePicker`.  
* “Save Edits” → PATCH `/edit/:id` (stays pending).  
* History of edits is visible in sidebar (*admin_feedback* list).

### 3.3 Manage Sources
* Grid view: URL, priority slider (0–100), enabled toggle, last success, error streak.  
* Inline slider changes → PATCH `/sources/:url` debounce 500 ms.  

### 3.4 Analytics
* KPI cards:  
  * “Approved last 7d”  
  * “Avg. time to approve”  
  * “Failure rate by source”  
* Charts via *VictoryNative* or *react-native-svg-charts*.

---

## 4. React Native / Expo Components

| Purpose | React Native / Expo Component |
|---------|------------------------------|
| Navigation | `@react-navigation/drawer`, `stack` |
| Table/List | `FlashList` / `FlatList` with `DataTable` rows |
| Drawer Detail | `react-native-modalize` or `BottomSheetModal` |
| Forms | `react-hook-form` + `@rneui/themed` inputs |
| Date/Time | `@react-native-community/datetimepicker` |
| Map preview | `react-native-maps` (shows pin of geocoded_json) |
| Charts | `victory-native` |
| Toasts | `react-native-toast-message` |
| Priority slider | `@react-native-community/slider` |
| State mgmt | `tanstack/react-query` for API calls + caching |

---

## 5. API Integration Points

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| List pending | GET | `/pending?status=PENDING&limit=50&offset=n` | Pagination / filters |
| Approve show | POST | `/approve/:id` | Body: `{ notes?:string }` |
| Reject show | POST | `/reject/:id` | Body: `{ reason:string }` |
| Edit show | PATCH | `/edit/:id` | Body: `{ normalized_json:object, notes?:string }` |
| List sources | GET | `/sources?limit=100` | |
| Update source | PATCH | `/sources/:url` | Body: `{ priority_score?, enabled?, notes? }` |

Auth header: `Bearer <admin JWT>` (obtained via Supabase Auth).

Use `react-query` hooks:
```ts
const { data } = useQuery(['pending', page], () =>
  fetch(`${API}/pending?limit=50&offset=${page*50}`, opts).then(r=>r.json()))
```

---

## 6. ASCII Mockups

### 6.1 Pending Queue (desktop width)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔍  [filter…]                                          [⟳ Refresh]        │
├────┬──────────────┬────────────┬────────────┬──────────┬─────────┬────────┤
│ ✓  │ Title        │ Start Date │ City       │ State    │ Src     │ Actions│
├────┼──────────────┼────────────┼────────────┼──────────┼─────────┼────────┤
│    │ Indy Show    │ 2025-01-05 │ Indianapolis│ IN      │ dpms    │ ▸      │
│    │ Midwest Expo │ 2025-02-10 │ Chicago     │ IL      │ tcdb    │ ▸      │
│    │ ...                                                               ... │
└────┴──────────────┴────────────┴────────────┴──────────┴─────────┴────────┘
```

### 6.2 Show Detail Drawer
```
┌───────────────────────────────────────────────┐
│ Indy Show          [Source: dpmsportcards.com]│
│───────────────────────────────────────────────│
│ Tabs:  Raw | Normalized | Map                │
│                                               │
│ Normalized (editable):                        │
│ Title:  [Indy Show_____________]              │
│ Date :  [2025-01-05]  –  [2025-01-05]         │
│ Venue:  [Fairgrounds Pavilion____]            │
│ Addr :  [123 Main St, Indianapolis, IN]       │
│ Fee  :  [$5]                                  │
│ Desc :  [__________multiline text area____]   │
│                                               │
│ [Save Edits]   [Reject]   [Approve & Publish] │
└───────────────────────────────────────────────┘
```

### 6.3 Source Manager
```
┌──────────────────────────────────────────────────────────────┐
│ URL                                       | Prio | Enabled  │
├────────────────────────────────────────────┼──────┼──────────┤
│ dpmsportcards.com/indiana-card-shows/     | [90] | [✓]       │
│ tcdb.com/CardShows.cfm                    | [85] | [✓]       │
│ sportscollectorsdigest.com/show-calendar  | [90] | [✓]       │
│ ...                                                               |
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Priority

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | **Pending Queue** list + Approve/Reject | Core gatekeeper function |
| P0 | Admin auth guard / JWT handling | Security |
| P1 | Edit & Save normalized data | Data quality |
| P1 | Source Manager (priority slider, toggle) | Keep scraper healthy |
| P2 | Map preview + geocode pin | Visual validation |
| P2 | Error & success analytics dashboard | Continuous improvement |
| P3 | Keyboard shortcuts / batch actions | Efficiency for power users |
| P3 | Dark mode / theming | Nice-to-have |

Suggested sprint order:
1. Scaffold Expo Web project & navigation.  
2. Build PendingQueue + ShowDetail (approve/reject).  
3. Hook up API calls via `react-query`.  
4. Add Edit-in-place, Save Edits.  
5. Source Manager view.  
6. Analytics KPIs & charts.  
7. Polishing: shortcuts, theming, tests.

---

## 8. Future Enhancements

* **Auto-approve rules** UI (for trusted sources).  
* **Bulk approve** multiple identical shows.  
* **Diff viewer** to compare normalized vs raw.  
* **Real-time notifications** via Supabase Realtime on new pending rows.  
* **Audit timeline** in ShowDetail using `admin_feedback` history.

---

### TL;DR
This document lays out a concrete blueprint (views, components, API hooks, mockups, priorities) to build the admin “god mode” UI in React Native / Expo, tightly integrated with the `admin-scraper-api` you already deployed. Follow the priority table and you’ll have a functional review console within one short sprint.
