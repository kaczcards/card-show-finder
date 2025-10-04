# Show Features & Categories

## Overview
The web form now includes checkboxes for show features and card categories to help collectors find shows that match their interests using search filters.

## Show Features
Users can select any combination of these features:

- 🔍 **On-Site Grading** - Professional grading services available at the show
- ✍️ **Autograph Guests** - Special guests for autographs and meet-and-greets
- 🍕 **Food Vendors** - Food and refreshments available on-site
- 🎁 **Door Prizes** - Giveaways and prizes for attendees
- 🔨 **Auction** - Live or silent auctions during the show
- 📦 **Card Breakers** - Live card breaking sessions

## Card Categories
Users can select what types of cards/collectibles will be available:

- ⚾ **Sports Cards** - Baseball, football, basketball, hockey, etc.
- ⚡ **Pokemon** - Pokemon TCG cards
- 🔮 **Magic: The Gathering** - MTG cards
- 🎴 **Yu-Gi-Oh** - Yu-Gi-Oh TCG cards
- 💥 **Comics** - Comic books and graphic novels
- 🏆 **Memorabilia** - Sports memorabilia, autographs, jerseys, etc.
- 📜 **Vintage** - Vintage and rare collectibles

## Database Schema

### Shows Table
- `features` - **JSONB** - Stores selected features as a JSON array
- `categories` - **text[]** - Stores selected categories as a PostgreSQL text array

### Example Data

**Single feature:**
```json
{
  "features": ["On-Site Grading"],
  "categories": ["Sports Cards", "Vintage"]
}
```

**Multiple features:**
```json
{
  "features": ["On-Site Grading", "Autograph Guests", "Food Vendors"],
  "categories": ["Sports Cards", "Pokemon", "Magic: The Gathering", "Comics"]
}
```

## Web Form Implementation

### HTML Structure
Checkboxes are organized in a responsive grid:
```html
<div class="checkbox-grid">
  <label class="checkbox-label">
    <input type="checkbox" name="features" value="On-Site Grading">
    <span>🔍 On-Site Grading</span>
  </label>
  <!-- More checkboxes... -->
</div>
```

### JavaScript Collection
```javascript
const formData = new FormData(form);
const features = formData.getAll('features');  // Array of selected features
const categories = formData.getAll('categories');  // Array of selected categories

const showData = {
  // ... other fields
  features: features,
  categories: categories
};
```

## Search & Filtering

### App Implementation Example
In your React Native app, you can filter shows based on these criteria:

```javascript
// Filter shows by features
const showsWithGrading = shows.filter(show => 
  show.features && show.features.includes('On-Site Grading')
);

// Filter shows by categories
const sportsCardShows = shows.filter(show =>
  show.categories && show.categories.includes('Sports Cards')
);

// Combined filter (has grading AND sports cards)
const filteredShows = shows.filter(show =>
  show.features?.includes('On-Site Grading') &&
  show.categories?.includes('Sports Cards')
);
```

### Search Filter UI Example
```javascript
// Multi-select filter component
<FilterSection title="Show Features">
  {['On-Site Grading', 'Autograph Guests', 'Food Vendors', 'Door Prizes', 'Auction', 'Card Breakers'].map(feature => (
    <Checkbox
      key={feature}
      label={feature}
      checked={selectedFeatures.includes(feature)}
      onToggle={() => toggleFeature(feature)}
    />
  ))}
</FilterSection>

<FilterSection title="Card Types">
  {['Sports Cards', 'Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh', 'Comics', 'Memorabilia', 'Vintage'].map(category => (
    <Checkbox
      key={category}
      label={category}
      checked={selectedCategories.includes(category)}
      onToggle={() => toggleCategory(category)}
    />
  ))}
</FilterSection>
```

### Supabase Query Example
```javascript
// Filter shows with specific features and categories
const { data: shows } = await supabase
  .from('shows')
  .select('*')
  .contains('categories', ['Sports Cards'])  // Has Sports Cards
  .filter('features', 'cs', '{"On-Site Grading"}')  // Has On-Site Grading
  .eq('status', 'ACTIVE')
  .gte('start_date', new Date().toISOString());
```

## Display on Show Cards

### Homepage/List View
Show feature icons on show cards:

```javascript
// ShowCard component
<View style={styles.featureIcons}>
  {show.features?.includes('On-Site Grading') && <Icon name="grading" />}
  {show.features?.includes('Autograph Guests') && <Icon name="autograph" />}
  {show.features?.includes('Food Vendors') && <Icon name="food" />}
  {/* etc */}
</View>

<View style={styles.categories}>
  {show.categories?.map(cat => (
    <Badge key={cat} text={cat} />
  ))}
</View>
```

### Detail Page
Show full list of features and categories:

```javascript
// ShowDetailScreen
<Section title="Show Features">
  {show.features && show.features.length > 0 ? (
    show.features.map(feature => (
      <FeatureRow key={feature} icon={getIcon(feature)} text={feature} />
    ))
  ) : (
    <Text>No special features listed</Text>
  )}
</Section>

<Section title="What's Available">
  {show.categories && show.categories.length > 0 ? (
    <View style={styles.categoryGrid}>
      {show.categories.map(cat => (
        <CategoryChip key={cat} text={cat} />
      ))}
    </View>
  ) : (
    <Text>No specific categories listed</Text>
  )}
</Section>
```

## Analytics & Insights

You can track which features and categories are most popular:

```sql
-- Most popular features
SELECT 
  feature,
  COUNT(*) as show_count
FROM shows, 
  jsonb_array_elements_text(features) AS feature
WHERE status = 'ACTIVE'
GROUP BY feature
ORDER BY show_count DESC;

-- Most popular categories
SELECT 
  UNNEST(categories) as category,
  COUNT(*) as show_count
FROM shows
WHERE status = 'ACTIVE'
GROUP BY category
ORDER BY show_count DESC;
```

## Benefits

### For Organizers
- Highlight unique features of their shows
- Attract specific collector audiences
- Stand out from other shows

### For Collectors
- Find shows that match their interests
- Filter out shows that don't have what they want
- Discover new shows with features they didn't know existed

### For You (Platform Owner)
- Better user engagement through personalized results
- Data on what collectors care about
- Opportunity for premium features (e.g., "Featured Show" badge for shows with many features)

## Future Enhancements

1. **Custom Features** - Allow organizers to add custom features not in the predefined list
2. **Feature Verification** - Badge system for verified features
3. **Popular Features Badge** - Highlight shows with rare/popular features
4. **Saved Filters** - Let users save their preferred feature/category combinations
5. **Push Notifications** - Notify users when a show matching their filters is added
6. **Premium Categories** - Paid upgrades for organizers to highlight certain categories
