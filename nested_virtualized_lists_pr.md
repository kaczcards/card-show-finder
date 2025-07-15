## Issue Fixed
This PR fixes the React Native warning `VirtualizedLists should never be nested inside plain ScrollViews`. This warning was occurring because we had FlatList components (used in UnclaimedShowsList and OrganizerShowsList) nested inside a ScrollView in the OrganizerDashboardScreen.

## Root Cause
The OrganizerDashboardScreen was using a ScrollView as its main container, but this ScrollView contained TabNavigator content that included FlatList components. This nesting of virtualized lists inside a non-virtualized ScrollView causes React Native to abandon the performance optimizations of the FlatLists.

## Changes Made
- Replaced the top-level ScrollView with a SectionList, which is a virtualized component
- Created distinct sections for different parts of the dashboard:
  - Header section
  - Metrics card section
  - Tabs navigation section
  - Content section (which contains the tab-specific content)
- Used useMemo for efficient section generation
- Preserved all existing functionality including pull-to-refresh
- Maintained the same visual appearance and UX

## Benefits
- Removes the React Native warning completely
- Improves performance by allowing proper virtualization of list content
- Reduces memory usage since off-screen content is no longer rendered
- Maintains the same user experience and visual design
- Properly follows React Native best practices for list rendering

*This is a Droid-assisted PR.*
