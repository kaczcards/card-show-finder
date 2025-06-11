# 📐 Card Show Finder — Design Mock-ups & UI Reference

This document serves as the single source of truth for visual design.  
All mock-ups are exported from the Figma file **“Card Show Finder – v1”** (link in the repository wiki) and placed under `assets/mockups/`.

---

## 1. Brand Foundations

### Color Palette

| Token | Color | Usage |
|-------|-------|-------|
| `primary` | `#3498db` | Buttons, icons, active tab |
| `secondary` | `#2ecc71` | Success states, secondary CTAs |
| `background` | `#ffffff` | Main surfaces |
| `card` | `#f8f9fa` | Card & section backgrounds |
| `text-primary` | `#212529` | Headings, body copy |
| `text-secondary` | `#6c757d` | Sub-copy, helper text |
| `error` | `#dc3545` | Validation, destructive actions |

### Typography

| Style | Font (iOS / Android) | Size | Weight |
|-------|----------------------|------|--------|
| H1 / Screen Title | System / SF Pro | 24 px | Bold |
| H2 | System | 18 px | Bold |
| Body | System | 16 px | Regular |
| Caption | System | 12 px | Regular |

> *Custom fonts can be added in a later release; system fonts keep bundle size minimal.*

---

## 2. Screen-by-Screen Mock-ups

### 2.1 Home — Discover Shows

![Home mock-up](assets/mockups/home.png)

Key elements  
1. **Search Bar** – sticky to top, shadow 2 dp  
2. **Filter Row** – date picker pill, sort chips, *Clear* text button  
3. **Result Cards** – 100 × 100 image thumbnail, text stack, price & rating badges  
4. Pull-to-refresh + empty-state illustration

Interaction highlights  
- Tapping a card pushes *Show Details* screen  
- Long-press opens quick actions (future)

### 2.2 Map — Nearby Shows

![Map mock-up](assets/mockups/map.png)

Components  
- Google Map (API key required)  
- Custom marker (circular blue w/ calendar icon)  
- Floating controls: *Fit to markers*, *Locate me* (bottom-right)  
- Card count toast (top)

### 2.3 Show Details

![Show Details mock-up](assets/mockups/details.png)

Layout  
1. **Hero Image** 100 % width, 250 px height, overlay back & favorite buttons  
2. Content sheet (rounded 20 px top):  
   - Title + price / rating badges  
   - Date, address rows (icon left)  
   - Description block  
   - Static map preview (tap → native maps)  
   - Three-button CTA row: *Directions*, *Add to Calendar*, *Share*  

Accessibility ≥ 4.5:1 contrast on all text.

### 2.4 Favorites

![Favorites mock-up](assets/mockups/favorites.png)

- Same card component as Home  
- Slide-in heart-dislike button top-right  
- Empty state with outlined heart & CTA *Browse Shows*

### 2.5 Profile & Settings

![Profile mock-up](assets/mockups/profile.png)

Sections  
1. Profile header – avatar editable, stats trio (attended, favorites, member since)  
2. **Account Settings** list  
3. **App Settings** toggles (Switch component)  
4. Support / About links  
5. Red **Logout** bar button

Auth flow (not shown) mirrors the same color system with minimal brand elements.

---

## 3. Component Library

| Component | Figma Layer Name | File |
|-----------|------------------|------|
| Primary Button | `Button/Primary` | `components/ButtonPrimary.tsx` |
| Search Input | `Input/Search` | `components/SearchBar.tsx` |
| Badge (Price) | `Badge/Positive` | `components/Badge.tsx` |
| Marker | `Map/Marker` | `components/MapMarker.tsx` |

Reusable assets live in `assets/ui/`.

---

## 4. Responsive & Platform Notes

- All screens use **Safe Area** padding.  
- Tab Bar height: iOS 83 pt / Android 56 dp.  
- Font scaling supported via `react-native` `allowFontScaling`.  
- Dark Mode: palette includes alternative surface `#121212`; see Figma page **“Dark Theme”**.

---

## 5. Illustration & Icon Sources

| Asset | License |
|-------|---------|
| Outline heart / calendar icons | Ionicons MIT |
| Empty-state illustrations | [Undraw](https://undraw.co) MIT |

---

## 6. Future Enhancements

- In-app onboarding carousel (Figma page *“Onboarding v2”*)  
- Ticket purchase flow (pending backend)  
- Real-time chat between collectors (concept wireframes ready)

---

_Last updated: 09 Jun 2025_  
Design owner: **@ux-alyssa** – please file issues in **/design** label.
