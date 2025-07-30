import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import theme from '../../constants/theme';

// Define the theme context type
type ThemeContextType = {
  theme: typeof theme;
  colorScheme: 'light' | 'dark';
};

// Create the theme context with default values
const _ThemeContext = createContext<ThemeContextType>({
  theme,
  colorScheme: 'light',
});

// Props for the ThemeProvider component
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider - Provides theme context to the entire application
 * 
 * This component wraps the application and provides access to theme settings
 * and color scheme information. It also handles dark/light mode detection.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ _children }) => {
  // Get device color scheme (light/dark)
  const _colorScheme = useColorScheme() || 'light';
  
  // We're just using the default theme for now, but this is where
  // you would implement any theme switching logic (e.g., dark mode)
  
  // Provide the theme context to the component tree
  return (
    <ThemeContext.Provider value={{ theme, colorScheme }}>
      {_children}
    </ThemeContext.Provider>
  );
};

/**
 * useTheme - Custom hook to access theme context
 * 
 * Use this hook in components to access theme values:
 * const { theme, colorScheme } = useTheme();
 */
export const _useTheme = () => useContext(_ThemeContext);

export default ThemeProvider;
