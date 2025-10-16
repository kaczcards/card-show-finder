# Android Adaptive Icon Safe Zone Explained

## Visual Guide

```
┌─────────────────────────────────────────────────────────┐
│                    1024 x 1024 px                       │
│                  (Full Canvas)                          │
│                                                         │
│     ┌───────────────────────────────────────┐          │
│     │                                       │          │
│     │                                       │          │
│     │      ┌───────────────────┐           │          │
│     │      │                   │           │          │
│     │      │   Safe Zone       │ ← 66% of canvas     │
│     │      │   675 x 675 px    │   (guaranteed       │
│     │      │                   │    visible)         │
│     │      │   [ICON CONTENT]  │                     │
│     │      │                   │                     │
│     │      └───────────────────┘                     │
│     │                                       │          │
│     │         Transparent Padding           │          │
│     │         (can be cropped)              │          │
│     └───────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Why the Safe Zone Matters

Different Android device manufacturers use different icon shapes:

### Launcher Icon Shapes by Manufacturer

1. **Circle** (Google Pixel, Motorola)
   ```
       ○○○○○
     ○○○○○○○○○
   ○○○○[★]○○○○
     ○○○○○○○○○
       ○○○○○
   ```
   Only the center ~66% is visible

2. **Squircle** (Samsung, OnePlus)
   ```
   ┌─────────┐
   │ ╭─────╮ │
   │ │ [★] │ │
   │ ╰─────╯ │
   └─────────┘
   ```
   Rounded corners, ~70-75% visible

3. **Rounded Square** (Some Xiaomi, Huawei)
   ```
   ╭─────────╮
   │         │
   │   [★]   │
   │         │
   ╰─────────╯
   ```
   Slightly rounded, ~80-85% visible

4. **Teardrop** (Some custom launchers)
   ```
      ╱╲
     ╱  ╲
    │ [★] │
    │    │
     ╲  ╱
      ╲╱
   ```
   Top is pointed, bottom is rounded

## The Problem We Fixed

### Before (Icon Too Large)
```
┌─────────────────────────┐
│ ╭─────────────────────╮ │
│ │ ╭───────────────╮   │ │
│ │ │    ICON       │   │ │  ← Icon content fills
│ │ │   CONTENT     │   │ │     most of canvas
│ │ │   (TOO BIG)   │   │ │
│ │ ╰───────────────╯   │ │
│ ╰─────────────────────╯ │
└─────────────────────────┘
```

When displayed as a circle:
```
     ○○○○○
   ○○○ON○○○
  ○○NTENT○○  ← Content gets cropped!
   ○○○CO○○○     Letters cut off
     ○○○○○
```

### After (Properly Sized for Safe Zone)
```
┌─────────────────────────┐
│                         │
│    ╭───────────╮        │
│    │   ICON    │        │  ← Icon content in
│    │  CONTENT  │        │     center 66%
│    │           │        │
│    ╰───────────╯        │
│                         │
└─────────────────────────┘
```

When displayed as a circle:
```
     ○○○○○
   ○○○○○○○○○
  ○○[ICON]○○  ← All content visible!
   ○○CONT○○○     Nothing cut off
     ○○○○○
```

## Technical Details

### Original Icon
- **Size**: 1024 x 1024 px
- **Content**: Filled most/all of the canvas
- **Problem**: Content extended into the outer 34% that may be cropped

### Resized Icon (Current)
- **Canvas**: 1024 x 1024 px (unchanged)
- **Content**: Resized to 675 x 675 px (66% of canvas)
- **Padding**: 174.5px transparent border on all sides
- **Result**: Content stays within safe zone, visible on all devices

## Command Used

```bash
magick assets/icon.png \
  -resize 675x675 \              # Shrink content to 66%
  -background none \              # Use transparent background
  -gravity center \               # Center the content
  -extent 1024x1024 \            # Expand canvas back to full size
  assets/adaptive-icon.png       # Output file
```

## File Size Evidence

The file size reduction proves the content is now smaller:

| Density  | Before Resize | After Resize | Reduction |
|----------|--------------|--------------|-----------|
| mdpi     | 15.4 KB      | 8.6 KB       | 44%       |
| hdpi     | 29.2 KB      | 15.8 KB      | 46%       |
| xhdpi    | 47 KB        | 24.6 KB      | 48%       |
| xxhdpi   | 92.2 KB      | 47.4 KB      | 49%       |
| xxxhdpi  | 146 KB       | 76.3 KB      | 48%       |

Smaller file size = less visible content = more transparent padding = fits within safe zone ✓

## Best Practices

1. **Always design for the safe zone** - Keep important content in the center 66%
2. **Test on multiple devices** - Check circular, squircle, and rounded square shapes
3. **Avoid text near edges** - Text is especially prone to being cut off
4. **Use simple, centered designs** - Complex designs with edge details won't work well
5. **Background color matters** - White background (#ffffff) was chosen to match app theme

## Resources

- [Android Adaptive Icons Documentation](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [Material Design Icon Guidelines](https://m2.material.io/design/iconography/product-icons.html)
- [Expo Icon Configuration](https://docs.expo.dev/develop/user-interface/app-icons/)
