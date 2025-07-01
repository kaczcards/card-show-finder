# Card Show Finder Theme System

This document provides an overview of the theme system in the Card Show Finder app, explaining how to use it to maintain consistent styling across the application.

## Overview

The theme system is designed to enforce visual consistency, reduce duplication, and make design changes easier to implement. It centralizes all design tokens (colors, typography, spacing, etc.) in one place and provides reusable components with consistent styling.

## Theme Structure

The theme is organized into the following modules:

- **Colors**: Brand colors, neutrals, feedback colors (success, error, etc.)
- **Typography**: Font families, sizes, weights, and text variants
- **Spacing**: Spacing scale and layout constants
- **Shadows**: Elevation and shadow styles
- **Animations**: Animation utilities and presets
- **Components**: Styles for common UI components

## How to Use the Theme

### 1. Accessing the Theme

Import the `useTheme` hook to access the theme in your components:

```tsx
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();
  
  // Now you can use theme values
  return (
    <View style={{ backgroundColor: theme.colors.background.default }}>
      <Text style={{ color: theme.colors.text.primary }}>Hello World</Text>
    </View>
  );
};
```

### 2. Using Reusable Components

For common UI elements, use the provided UI components that automatically apply the theme:

```tsx
import { Button, Loading, ErrorDisplay } from '../components/ui';

const MyScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Example usage
  if (loading) {
    return <Loading message="Loading data..." />;
  }
  
  if (error) {
    return (
      <ErrorDisplay 
        message={error} 
        onRetry={() => fetchData()} 
      />
    );
  }
  
  return (
    <View>
      <Text>My Screen Content</Text>
      <Button 
        variant="primary" 
        label="Save" 
        onPress={handleSave} 
      />
    </View>
  );
};
```

### 3. Styling New Components

When creating new components, reference the theme values directly:

```tsx
import { StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const MyNewComponent = () => {
  const { theme } = useTheme();
  
  // Create styles using theme values
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.paper,
      padding: theme.spacing.spacing.medium,
      borderRadius: theme.spacing.layout.borderRadius.medium,
      ...theme.shadows.small,
    },
    title: {
      ...theme.typography.variant.title,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.spacing.small,
    },
    description: {
      ...theme.typography.variant.body1,
      color: theme.colors.text.secondary,
    },
  });
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Title</Text>
      <Text style={styles.description}>Description text</Text>
    </View>
  );
};
```

## Theme Color Palette

### Brand Colors

- **Primary (Orange)**
  - Main: `#FF6A00`
  - Light: `#FF8C3D`
  - Dark: `#CC5500`

- **Secondary (Blue)**
  - Main: `#0057B8`
  - Light: `#3679D0`
  - Dark: `#004693`

### Neutrals

- White: `#FFFFFF`
- Background: `#F8F8F8`
- Light Gray: `#EEEEEE`
- Border: `#DDDDDD`
- Medium Gray: `#999999`
- Dark Gray: `#666666`
- Text: `#333333`
- Black: `#000000`

### Feedback Colors

- **Success**
  - Light: `#E3F9E5`
  - Main: `#4CAF50`
  - Dark: `#388E3C`

- **Error**
  - Light: `#FFEBEE`
  - Main: `#F44336`
  - Dark: `#C62828`

- **Warning**
  - Light: `#FFF8E1`
  - Main: `#FFC107`
  - Dark: `#FFA000`

- **Info**
  - Light: `#E6F4FF`
  - Main: `#2196F3`
  - Dark: `#0D47A1`

## Typography

### Font Sizes

- XS: 10px
- Small: 12px
- Body: 14px
- Button: 16px
- Title: 18px
- H3: 20px
- H2: 24px
- H1: 28px
- Display: 34px

### Font Weights

- Thin: '200'
- Light: '300'
- Regular: '400'
- Medium: '500'
- Semi Bold: '600'
- Bold: '700'
- Extra Bold: '800'

## Spacing

Base unit: 4px

- XS: 4px
- Small: 8px
- Medium: 16px
- Large: 24px
- XL: 32px
- XXL: 48px

## Shadows/Elevation

- None: No shadow
- XS: Subtle shadow for small elements
- Small: Cards, buttons
- Medium: Floating action buttons, nav bars
- Large: Modals, dialogs
- XL: Popovers, tooltips

## Available UI Components

### Button

```tsx
<Button
  variant="primary" // 'primary', 'secondary', 'outline', 'text'
  label="Press Me"
  onPress={() => {}}
  disabled={false}
  loading={false}
  animated={true}
/>
```

### Loading

```tsx
<Loading
  type="fullScreen" // 'fullScreen', 'inline'
  message="Loading data..."
  size="large" // 'small', 'large'
/>
```

### ErrorDisplay

```tsx
<ErrorDisplay
  type="inline" // 'fullScreen', 'inline'
  title="Error Title" // Only for fullScreen
  message="Something went wrong"
  onRetry={() => {}} // Optional retry function
  retryText="Try Again" // Custom retry button text
/>
```

## Best Practices

1. **Always Use Theme Colors**: Don't hardcode color values; use theme colors instead.
2. **Consistent Spacing**: Use the theme spacing values rather than arbitrary pixel values.
3. **Typography Variants**: Use typography variants for text styling.
4. **Component Reuse**: Use the provided UI components when possible.
5. **Dynamic Styles**: Create styles inside components using the theme hook to allow for theme updates.

## Contributing to the Theme

When adding new styles or components to the theme:

1. Place global styles in the appropriate theme module.
2. Create reusable components in the `src/components/ui` directory.
3. Document new additions in this guide.
4. Update existing components to use the theme system.
