## Issue Fixed
This PR fixes two React Native warnings:

1. `VirtualizedLists should never be nested inside plain ScrollViews` - Occurring because we had FlatList components (used in UnclaimedShowsList and OrganizerShowsList) nested inside a ScrollView in the OrganizerDashboardScreen.

2. `Encountered two children with the same key` - Occurring in our SectionList implementation because multiple sections were using data items with similar key patterns.

## Root Causes
1. **Nested Lists**: The OrganizerDashboardScreen was using a ScrollView as its main container, but this ScrollView contained TabNavigator content that included FlatList components. This nesting of virtualized lists inside a non-virtualized ScrollView causes React Native to abandon the performance optimizations of the FlatLists.

2. **Duplicate Keys**: The SectionList component was encountering data items with duplicate keys, which is a React anti-pattern that can lead to rendering issues.

## Changes Made
1. **For Nested Lists:**
   - Replaced the top-level ScrollView with a SectionList, which is a virtualized component
   - Created distinct sections for different parts of the dashboard:
     - Header section
     - Metrics card section
     - Tabs navigation section
     - Content section (which contains the tab-specific content)
   - Used useMemo for efficient section generation
   - Preserved all existing functionality including pull-to-refresh

2. **For Duplicate Keys:**
   - Created a proper SectionItem interface with unique id field
   - Generated unique IDs for each section item using timestamp
   - Included activeTab in content section ID to ensure uniqueness when tab changes
   - Added more explicit typing for section data to improve type safety

## Benefits
- Removes both React Native warnings completely
- Improves performance by allowing proper virtualization of list content
- Reduces memory usage since off-screen content is no longer rendered
- Maintains the same user experience and visual design
- Properly follows React Native best practices for list rendering

*This is a Droid-assisted PR.*
