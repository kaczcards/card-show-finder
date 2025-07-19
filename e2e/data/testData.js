// e2e/data/testData.js
/**
 * Comprehensive test data for Card Show Finder E2E tests
 * This file contains all the test data needed for E2E testing
 */

// ====================================
// 1. TEST USER CREDENTIALS
// ====================================

const TEST_USER_CREDENTIALS = {
  // Regular user
  regularUser: {
    email: 'test-regular@example.com',
    password: 'Test123!@#',
    username: 'testregular',
    homeZip: '90210',
    displayName: 'Test Regular User',
  },
  
  // Admin user
  adminUser: {
    email: 'test-admin@example.com',
    password: 'Admin123!@#',
    username: 'testadmin',
    homeZip: '10001',
    displayName: 'Test Admin',
    role: 'admin',
  },
  
  // MVP dealer user
  mvpDealerUser: {
    email: 'test-mvp-dealer@example.com',
    password: 'Dealer123!@#',
    username: 'testmvpdealer',
    homeZip: '60601',
    displayName: 'Test MVP Dealer',
    role: 'mvp_dealer',
    dealerInfo: {
      businessName: 'Test MVP Cards',
      phone: '555-123-4567',
      socialMedia: {
        instagram: 'testmvpcards',
        twitter: 'testmvpcards',
        facebook: 'testmvpcards',
      },
      specialties: ['vintage', 'baseball', 'basketball'],
    },
  },
  
  // Show organizer user
  showOrganizerUser: {
    email: 'test-organizer@example.com',
    password: 'Organizer123!@#',
    username: 'testorganizer',
    homeZip: '77002',
    displayName: 'Test Show Organizer',
    role: 'show_organizer',
    organizerInfo: {
      companyName: 'Test Card Shows Inc.',
      phone: '555-987-6543',
      website: 'https://testcardshows.example.com',
    },
  },
  
  // Invalid credentials for error testing
  invalidCredentials: {
    email: 'nonexistent@example.com',
    password: 'WrongPassword123!',
    username: 'nonexistentuser',
  },
  
  // Edge cases
  edgeCases: {
    veryLongEmail: {
      email: 'this.is.a.very.long.email.address.that.exceeds.normal.length.limits.and.should.be.tested.for.proper.handling.in.the.application.interface.and.backend.validation@verylongdomainname.example.com',
      password: 'EdgeCase123!',
    },
    veryLongUsername: {
      email: 'long-username@example.com',
      password: 'EdgeCase123!',
      username: 'ThisIsAnExtremelyLongUsernameThatExceedsNormalLengthLimitsAndShouldBeTestedForProperHandlingInTheApplicationInterfaceAndBackendValidation',
    },
    specialCharactersUsername: {
      email: 'special-chars@example.com',
      password: 'EdgeCase123!',
      username: 'user_name-with.special@chars',
    },
    emptyFields: {
      email: '',
      password: '',
      username: '',
    },
  },
};

// ====================================
// 2. TEST SHOW DATA
// ====================================

// Helper function to create dates relative to today
const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const TEST_SHOWS_DATA = {
  // Upcoming shows
  upcomingShows: [
    {
      name: 'Los Angeles Sports Card Expo',
      description: 'The largest sports card show in Southern California featuring dealers from across the country. Find rare vintage cards, modern releases, and meet special guests for autograph sessions.',
      address: '1201 S Figueroa St, Los Angeles, CA 90015',
      startDate: daysFromNow(7),
      endDate: daysFromNow(9),
      entryFee: 10.00,
      coordinates: { lat: 34.043018, lng: -118.267254 },
      features: ['sports', 'vintage', 'modern', 'autographs'],
      tables: 120,
      attendees: 3500,
    },
    {
      name: 'New York Collectibles Convention',
      description: 'Premier trading card event in NYC with focus on sports and non-sports collectibles. Special focus on rookie cards and graded collections.',
      address: '655 W 34th St, New York, NY 10001',
      startDate: daysFromNow(14),
      endDate: daysFromNow(16),
      entryFee: 15.00,
      coordinates: { lat: 40.757205, lng: -74.002423 },
      features: ['sports', 'non-sports', 'graded'],
      tables: 200,
      attendees: 5000,
    },
    {
      name: 'Chicago Pokemon TCG Tournament',
      description: 'Official Pokemon Trading Card Game tournament with competitive play and casual trading. Prizes for tournament winners and special edition cards available.',
      address: '2301 S Lake Shore Dr, Chicago, IL 60616',
      startDate: daysFromNow(21),
      endDate: daysFromNow(22),
      entryFee: 25.00,
      coordinates: { lat: 41.851505, lng: -87.617011 },
      features: ['pokemon', 'tournament', 'trading'],
      tables: 80,
      attendees: 1200,
    },
  ],
  
  // Past shows (for testing historical data)
  pastShows: [
    {
      name: 'Houston Baseball Card Show',
      description: 'Baseball-focused card show featuring vintage and modern cards, memorabilia, and dealer booths.',
      address: '1 NRG Park, Houston, TX 77054',
      startDate: daysFromNow(-14),
      endDate: daysFromNow(-12),
      entryFee: 8.00,
      coordinates: { lat: 29.685058, lng: -95.410567 },
      features: ['baseball', 'vintage', 'memorabilia'],
      tables: 75,
      attendees: 1800,
    },
    {
      name: 'Phoenix Magic: The Gathering Exchange',
      description: 'Trading event for Magic: The Gathering players and collectors. Buy, sell, and trade cards from all editions.',
      address: '100 N 3rd St, Phoenix, AZ 85004',
      startDate: daysFromNow(-30),
      endDate: daysFromNow(-29),
      entryFee: 5.00,
      coordinates: { lat: 33.451697, lng: -112.073199 },
      features: ['magic', 'trading'],
      tables: 40,
      attendees: 600,
    },
  ],
  
  // Shows with special characteristics
  specialShows: {
    freeEntry: {
      name: 'San Diego Card Swap Meet',
      description: 'Free community card trading event. No admission fee, just bring your cards to trade!',
      address: '2688 East Mission Bay Drive, San Diego, CA 92109',
      startDate: daysFromNow(10),
      endDate: daysFromNow(10),
      entryFee: 0.00,
      coordinates: { lat: 32.791389, lng: -117.209722 },
      features: ['trading', 'community'],
      tables: 25,
      attendees: 300,
    },
    highEndShow: {
      name: 'Luxury Card Collectors Summit',
      description: 'Exclusive high-end card show featuring rare and valuable cards. Premium experience with limited attendance.',
      address: '3600 S Las Vegas Blvd, Las Vegas, NV 89109',
      startDate: daysFromNow(45),
      endDate: daysFromNow(47),
      entryFee: 100.00,
      coordinates: { lat: 36.114784, lng: -115.172924 },
      features: ['luxury', 'rare', 'investment', 'graded'],
      tables: 30,
      attendees: 500,
    },
    veryLongDescription: {
      name: 'Seattle Trading Card Festival',
      description: 'This is an extremely long description that exceeds normal length limits and should be tested for proper handling in the application interface. It contains multiple paragraphs and formatting to ensure the app can handle complex content properly. The Seattle Trading Card Festival is the premier event for card collectors in the Pacific Northwest, featuring hundreds of dealers, special guests, tournaments, and more.\n\nThe event will have dedicated areas for different card types including sports cards, Pokemon, Magic: The Gathering, Yu-Gi-Oh!, and other collectible card games. There will be hourly door prizes, authentication services on-site, and special panels with industry experts discussing collecting trends and investment strategies.\n\nFood vendors will be available throughout the venue, and parking is included with admission. Please note that all transactions over $500 will require ID verification as per venue policy. We look forward to seeing you there!',
      address: '800 Convention Pl, Seattle, WA 98101',
      startDate: daysFromNow(30),
      endDate: daysFromNow(32),
      entryFee: 12.50,
      coordinates: { lat: 47.611493, lng: -122.332290 },
      features: ['sports', 'pokemon', 'magic', 'yugioh', 'vintage', 'modern', 'tournament', 'autographs'],
      tables: 150,
      attendees: 4000,
    },
  },
  
  // Edge cases
  edgeCases: {
    startingSoon: {
      name: 'Last Minute Card Meetup',
      description: 'Impromptu card trading meetup organized at the last minute.',
      address: '123 Main St, Anytown, USA',
      startDate: daysFromNow(1),
      endDate: daysFromNow(1),
      entryFee: 2.00,
      coordinates: { lat: 40.712776, lng: -74.005974 },
      features: ['trading'],
      tables: 10,
      attendees: 50,
    },
    veryFarFuture: {
      name: 'Future Card Expo 2030',
      description: 'Plan way ahead for this major card expo scheduled for 2030.',
      address: '1000 Future Blvd, Tomorrow City, CA 90000',
      startDate: '2030-01-01T10:00:00.000Z',
      endDate: '2030-01-05T18:00:00.000Z',
      entryFee: 20.00,
      coordinates: { lat: 34.052235, lng: -118.243683 },
      features: ['sports', 'pokemon', 'magic', 'yugioh', 'vintage', 'modern'],
      tables: 500,
      attendees: 10000,
    },
    multiDayShow: {
      name: 'Week-Long Card Extravaganza',
      description: 'An extended week-long card show with different themes each day.',
      address: '123 Convention Way, Orlando, FL 32819',
      startDate: daysFromNow(60),
      endDate: daysFromNow(67),
      entryFee: 30.00,
      coordinates: { lat: 28.424671, lng: -81.470345 },
      features: ['sports', 'pokemon', 'magic', 'yugioh', 'vintage', 'modern', 'tournament'],
      tables: 300,
      attendees: 15000,
    },
  },
};

// ====================================
// 3. TEST LOCATION DATA
// ====================================

const TEST_LOCATIONS = {
  // Major US cities
  usCities: [
    { name: 'Los Angeles, CA', lat: 34.052235, lng: -118.243683, zipCode: '90012' },
    { name: 'New York, NY', lat: 40.712776, lng: -74.005974, zipCode: '10007' },
    { name: 'Chicago, IL', lat: 41.878113, lng: -87.629799, zipCode: '60601' },
    { name: 'Houston, TX', lat: 29.760427, lng: -95.369804, zipCode: '77002' },
    { name: 'Phoenix, AZ', lat: 33.448376, lng: -112.074036, zipCode: '85004' },
    { name: 'Philadelphia, PA', lat: 39.952583, lng: -75.165222, zipCode: '19107' },
    { name: 'San Antonio, TX', lat: 29.424349, lng: -98.491142, zipCode: '78205' },
    { name: 'San Diego, CA', lat: 32.715736, lng: -117.161087, zipCode: '92101' },
    { name: 'Dallas, TX', lat: 32.776665, lng: -96.796989, zipCode: '75201' },
    { name: 'San Jose, CA', lat: 37.338207, lng: -121.886330, zipCode: '95113' },
  ],
  
  // International locations (for future international expansion testing)
  internationalCities: [
    { name: 'Toronto, Canada', lat: 43.651070, lng: -79.347015, zipCode: 'M5V 2H1' },
    { name: 'London, UK', lat: 51.507351, lng: -0.127758, zipCode: 'SW1A 1AA' },
    { name: 'Tokyo, Japan', lat: 35.689487, lng: 139.691711, zipCode: '100-0001' },
    { name: 'Sydney, Australia', lat: -33.868820, lng: 151.209290, zipCode: '2000' },
    { name: 'Mexico City, Mexico', lat: 19.432608, lng: -99.133209, zipCode: '06000' },
  ],
  
  // Remote locations
  remoteLocations: [
    { name: 'Barrow, AK', lat: 71.290556, lng: -156.788611, zipCode: '99723' },
    { name: 'Honolulu, HI', lat: 21.306944, lng: -157.858333, zipCode: '96813' },
    { name: 'Key West, FL', lat: 24.555059, lng: -81.779984, zipCode: '33040' },
    { name: 'Fargo, ND', lat: 46.877186, lng: -96.789803, zipCode: '58102' },
    { name: 'Juneau, AK', lat: 58.301935, lng: -134.419740, zipCode: '99801' },
  ],
  
  // Invalid locations
  invalidLocations: [
    { name: 'Invalid Coordinates', lat: 999.999, lng: 999.999, zipCode: '00000' },
    { name: 'Middle of Ocean', lat: 0.0, lng: 0.0, zipCode: '00000' },
    { name: 'North Pole', lat: 90.0, lng: 0.0, zipCode: '00000' },
    { name: 'South Pole', lat: -90.0, lng: 0.0, zipCode: '00000' },
  ],
  
  // Location search radii
  searchRadii: [
    { name: '25 miles', value: 25 },
    { name: '50 miles', value: 50 },
    { name: '100 miles', value: 100 },
    { name: '200 miles', value: 200 },
    { name: 'Nationwide', value: 3000 },
  ],
};

// ====================================
// 4. TEST SEARCH QUERIES
// ====================================

const TEST_SEARCH_QUERIES = {
  // Valid searches
  validSearches: [
    { term: 'card', expectedResults: true, category: 'general' },
    { term: 'sports', expectedResults: true, category: 'category' },
    { term: 'pokemon', expectedResults: true, category: 'category' },
    { term: 'magic', expectedResults: true, category: 'category' },
    { term: 'los angeles', expectedResults: true, category: 'location' },
    { term: 'new york', expectedResults: true, category: 'location' },
    { term: 'expo', expectedResults: true, category: 'event' },
    { term: 'convention', expectedResults: true, category: 'event' },
    { term: 'tournament', expectedResults: true, category: 'event' },
    { term: 'free', expectedResults: true, category: 'price' },
  ],
  
  // Searches with special characters
  specialCharacterSearches: [
    { term: 'card\'s', expectedResults: true, category: 'special' },
    { term: 'card-show', expectedResults: true, category: 'special' },
    { term: 'card & collectibles', expectedResults: true, category: 'special' },
    { term: 'card/show', expectedResults: true, category: 'special' },
    { term: 'card+show', expectedResults: true, category: 'special' },
    { term: 'card%show', expectedResults: false, category: 'special' },
    { term: 'card$how', expectedResults: false, category: 'special' },
    { term: 'card#show', expectedResults: false, category: 'special' },
  ],
  
  // Edge cases
  edgeCaseSearches: {
    emptySearch: { term: '', expectedResults: true, category: 'edge' },
    veryLongSearch: { 
      term: 'This is an extremely long search query that exceeds normal length limits and should be tested for proper handling in the application interface and backend search functionality to ensure it does not cause performance issues or crashes',
      expectedResults: false,
      category: 'edge'
    },
    singleCharacter: { term: 'a', expectedResults: true, category: 'edge' },
    numericOnly: { term: '12345', expectedResults: false, category: 'edge' },
    zipCodeSearch: { term: '90210', expectedResults: true, category: 'edge' },
  },
  
  // Filter combinations
  filterCombinations: [
    { 
      name: 'Sports cards within 50 miles',
      filters: { 
        category: 'sports',
        radius: 50,
        startDate: daysFromNow(0),
        endDate: daysFromNow(90),
        entryFee: 'any'
      },
      expectedResults: true
    },
    { 
      name: 'Free Pokemon events',
      filters: { 
        category: 'pokemon',
        radius: 200,
        startDate: daysFromNow(0),
        endDate: daysFromNow(90),
        entryFee: 'free'
      },
      expectedResults: true
    },
    { 
      name: 'Magic tournaments next week',
      filters: { 
        category: 'magic',
        radius: 100,
        startDate: daysFromNow(0),
        endDate: daysFromNow(7),
        entryFee: 'any'
      },
      expectedResults: true
    },
    { 
      name: 'All shows nationwide',
      filters: { 
        category: 'all',
        radius: 3000,
        startDate: daysFromNow(0),
        endDate: daysFromNow(365),
        entryFee: 'any'
      },
      expectedResults: true
    },
  ],
};

// ====================================
// 5. TEST CARDS AND COLLECTIONS
// ====================================

const TEST_CARDS_DATA = {
  // Sports cards
  sportsCards: [
    {
      id: 'card-s1',
      name: 'Mike Trout Rookie Card',
      year: 2011,
      brand: 'Topps',
      set: 'Update',
      number: 'US175',
      sport: 'baseball',
      player: 'Mike Trout',
      condition: 'PSA 10',
      estimatedValue: 1500.00,
      forSale: true,
      askingPrice: 1800.00,
      image: 'mike_trout_rookie.jpg',
      tags: ['baseball', 'rookie', 'graded', 'modern'],
    },
    {
      id: 'card-s2',
      name: 'LeBron James Rookie Card',
      year: 2003,
      brand: 'Upper Deck',
      set: 'Ultimate Collection',
      number: '127',
      sport: 'basketball',
      player: 'LeBron James',
      condition: 'BGS 9.5',
      estimatedValue: 5000.00,
      forSale: false,
      askingPrice: null,
      image: 'lebron_rookie.jpg',
      tags: ['basketball', 'rookie', 'graded', 'modern'],
    },
    {
      id: 'card-s3',
      name: 'Tom Brady Rookie Card',
      year: 2000,
      brand: 'Playoff Contenders',
      set: 'Championship Ticket',
      number: '144',
      sport: 'football',
      player: 'Tom Brady',
      condition: 'Raw',
      estimatedValue: 8000.00,
      forSale: true,
      askingPrice: 10000.00,
      image: 'brady_rookie.jpg',
      tags: ['football', 'rookie', 'autograph', 'modern'],
    },
    {
      id: 'card-s4',
      name: 'Mickey Mantle',
      year: 1952,
      brand: 'Topps',
      set: 'Base',
      number: '311',
      sport: 'baseball',
      player: 'Mickey Mantle',
      condition: 'PSA 4',
      estimatedValue: 100000.00,
      forSale: false,
      askingPrice: null,
      image: 'mantle_1952.jpg',
      tags: ['baseball', 'vintage', 'graded', 'investment'],
    },
    {
      id: 'card-s5',
      name: 'Wayne Gretzky Rookie Card',
      year: 1979,
      brand: 'O-Pee-Chee',
      set: 'Base',
      number: '18',
      sport: 'hockey',
      player: 'Wayne Gretzky',
      condition: 'PSA 8',
      estimatedValue: 20000.00,
      forSale: true,
      askingPrice: 25000.00,
      image: 'gretzky_rookie.jpg',
      tags: ['hockey', 'rookie', 'graded', 'vintage'],
    },
  ],
  
  // Pokemon cards
  pokemonCards: [
    {
      id: 'card-p1',
      name: 'Charizard',
      year: 1999,
      set: 'Base Set',
      number: '4/102',
      rarity: 'Holo Rare',
      condition: 'PSA 9',
      estimatedValue: 2000.00,
      forSale: true,
      askingPrice: 2500.00,
      image: 'charizard_base.jpg',
      tags: ['pokemon', 'vintage', 'graded', 'holo'],
    },
    {
      id: 'card-p2',
      name: 'Pikachu Illustrator',
      year: 1998,
      set: 'Promo',
      number: 'N/A',
      rarity: 'Promo',
      condition: 'PSA 7',
      estimatedValue: 500000.00,
      forSale: false,
      askingPrice: null,
      image: 'pikachu_illustrator.jpg',
      tags: ['pokemon', 'vintage', 'graded', 'promo', 'rare'],
    },
    {
      id: 'card-p3',
      name: 'Lugia',
      year: 2000,
      set: 'Neo Genesis',
      number: '9/111',
      rarity: 'Holo Rare',
      condition: 'PSA 10',
      estimatedValue: 1500.00,
      forSale: true,
      askingPrice: 2000.00,
      image: 'lugia_neo.jpg',
      tags: ['pokemon', 'vintage', 'graded', 'holo'],
    },
  ],
  
  // Magic: The Gathering cards
  magicCards: [
    {
      id: 'card-m1',
      name: 'Black Lotus',
      year: 1993,
      set: 'Alpha',
      rarity: 'Rare',
      condition: 'BGS 8.5',
      estimatedValue: 100000.00,
      forSale: false,
      askingPrice: null,
      image: 'black_lotus_alpha.jpg',
      tags: ['magic', 'power nine', 'graded', 'vintage', 'reserve list'],
    },
    {
      id: 'card-m2',
      name: 'Mox Sapphire',
      year: 1993,
      set: 'Beta',
      rarity: 'Rare',
      condition: 'CGC 9',
      estimatedValue: 15000.00,
      forSale: true,
      askingPrice: 20000.00,
      image: 'mox_sapphire_beta.jpg',
      tags: ['magic', 'power nine', 'graded', 'vintage', 'reserve list'],
    },
  ],
  
  // Collections
  collections: {
    smallCollection: {
      id: 'coll-1',
      name: 'My Baseball Rookies',
      description: 'Collection of rookie cards from my favorite players',
      cards: ['card-s1', 'card-s4'],
      totalValue: 101500.00,
      visibility: 'public',
      tags: ['baseball', 'rookie', 'investment'],
    },
    largeCollection: {
      id: 'coll-2',
      name: 'Vintage Pokemon Collection',
      description: 'Complete set of original Pokemon cards from 1999-2000',
      cards: ['card-p1', 'card-p2', 'card-p3'],
      totalValue: 503500.00,
      visibility: 'private',
      tags: ['pokemon', 'vintage', 'complete set'],
    },
    emptyCollection: {
      id: 'coll-3',
      name: 'Cards To Acquire',
      description: 'Wishlist of cards I want to buy',
      cards: [],
      totalValue: 0.00,
      visibility: 'private',
      tags: ['wishlist'],
    },
    mixedCollection: {
      id: 'coll-4',
      name: 'My Favorite Cards',
      description: 'A mix of my favorite cards across different categories',
      cards: ['card-s2', 'card-p1', 'card-m1'],
      totalValue: 107000.00,
      visibility: 'public',
      tags: ['mixed', 'favorites', 'investment'],
    },
  },
  
  // Want lists
  wantLists: {
    baseballWantList: {
      id: 'want-1',
      name: 'Baseball Rookie Cards',
      description: 'Rookie cards I\'m looking for at the next show',
      items: [
        { description: '2018 Shohei Ohtani Topps Chrome', priority: 'high' },
        { description: '2019 Vladimir Guerrero Jr. Topps', priority: 'medium' },
        { description: '2020 Luis Robert Bowman Chrome', priority: 'low' },
      ],
      visibility: 'public',
      showId: null, // Will be populated with a specific show ID during tests
    },
    pokemonWantList: {
      id: 'want-2',
      name: 'Pokemon WOTC Holos',
      description: 'Wizards of the Coast era holo cards I need',
      items: [
        { description: 'Blastoise Base Set Holo', priority: 'high' },
        { description: 'Venusaur Base Set Holo', priority: 'high' },
        { description: 'Alakazam Base Set Holo', priority: 'medium' },
      ],
      visibility: 'public',
      showId: null, // Will be populated with a specific show ID during tests
    },
    emptyWantList: {
      id: 'want-3',
      name: 'New Want List',
      description: '',
      items: [],
      visibility: 'private',
      showId: null,
    },
  },
};

// ====================================
// 6. TEST SUBSCRIPTION DATA
// ====================================

const TEST_SUBSCRIPTION_DATA = {
  // Subscription tiers
  tiers: {
    free: {
      name: 'Free',
      price: 0,
      period: null,
      features: [
        'Browse all shows',
        'Create basic want lists',
        'Save favorite shows',
      ],
    },
    mvpDealer: {
      name: 'MVP Dealer',
      price: 9.99,
      period: 'monthly',
      yearlyPrice: 99.99,
      yearlyPeriod: 'yearly',
      features: [
        'All Free tier features',
        'Dealer profile with contact info',
        'Social media links',
        'View attendee want lists',
        'Priority listing in dealer directory',
      ],
    },
    showOrganizer: {
      name: 'Show Organizer',
      price: 29.99,
      period: 'monthly',
      yearlyPrice: 299.99,
      yearlyPeriod: 'yearly',
      features: [
        'All MVP Dealer features',
        'Create and manage shows',
        'Send announcements to attendees',
        'Access attendee analytics',
        'Manage dealer registrations',
      ],
    },
  },
  
  // User subscription states
  subscriptionStates: {
    freeUser: {
      tier: 'free',
      startDate: null,
      endDate: null,
      autoRenew: false,
      paymentMethod: null,
      status: 'active',
    },
    activeMvpDealer: {
      tier: 'mvpDealer',
      startDate: daysFromNow(-30),
      endDate: daysFromNow(335), // Annual subscription
      autoRenew: true,
      paymentMethod: 'stripe',
      status: 'active',
    },
    activeShowOrganizer: {
      tier: 'showOrganizer',
      startDate: daysFromNow(-15),
      endDate: daysFromNow(15), // Monthly subscription
      autoRenew: true,
      paymentMethod: 'stripe',
      status: 'active',
    },
    trialUser: {
      tier: 'mvpDealer',
      startDate: daysFromNow(-1),
      endDate: daysFromNow(6), // 7-day trial
      autoRenew: false,
      paymentMethod: null,
      status: 'trial',
    },
    expiredSubscription: {
      tier: 'mvpDealer',
      startDate: daysFromNow(-60),
      endDate: daysFromNow(-1), // Expired yesterday
      autoRenew: false,
      paymentMethod: 'stripe',
      status: 'expired',
    },
    canceledSubscription: {
      tier: 'showOrganizer',
      startDate: daysFromNow(-45),
      endDate: daysFromNow(15), // Still active but canceled
      autoRenew: false,
      paymentMethod: 'stripe',
      status: 'canceled',
    },
  },
  
  // Payment methods
  paymentMethods: {
    validCreditCard: {
      type: 'credit_card',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
      brand: 'visa',
    },
    expiredCreditCard: {
      type: 'credit_card',
      last4: '0341',
      expMonth: 6,
      expYear: 2023, // Expired
      brand: 'mastercard',
    },
    validPayPal: {
      type: 'paypal',
      email: 'test@example.com',
    },
  },
  
  // Subscription errors
  subscriptionErrors: {
    paymentFailed: {
      code: 'payment_failed',
      message: 'Your payment method was declined. Please update your payment information.',
    },
    invalidPromo: {
      code: 'invalid_promo',
      message: 'The promotion code you entered is invalid or has expired.',
    },
    alreadySubscribed: {
      code: 'already_subscribed',
      message: 'You already have an active subscription to this tier.',
    },
  },
};

// ====================================
// 7. TEST ERROR SCENARIOS
// ====================================

const TEST_ERROR_SCENARIOS = {
  // Network errors
  networkErrors: {
    timeout: {
      name: 'Network Timeout',
      message: 'Request timed out after 30 seconds',
      code: 'ETIMEDOUT',
      status: 408,
    },
    offline: {
      name: 'Offline',
      message: 'No internet connection available',
      code: 'OFFLINE',
      status: null,
    },
    serverUnavailable: {
      name: 'Server Unavailable',
      message: 'The server is temporarily unavailable',
      code: 'ECONNREFUSED',
      status: 503,
    },
  },
  
  // Authentication errors
  authErrors: {
    invalidCredentials: {
      name: 'Invalid Credentials',
      message: 'The email or password you entered is incorrect',
      code: 'auth/invalid-credentials',
      status: 401,
    },
    accountLocked: {
      name: 'Account Locked',
      message: 'Your account has been locked due to too many failed login attempts',
      code: 'auth/account-locked',
      status: 403,
    },
    emailNotVerified: {
      name: 'Email Not Verified',
      message: 'Please verify your email address before logging in',
      code: 'auth/email-not-verified',
      status: 403,
    },
    passwordResetRequired: {
      name: 'Password Reset Required',
      message: 'You must reset your password before continuing',
      code: 'auth/password-reset-required',
      status: 403,
    },
  },
  
  // Permission errors
  permissionErrors: {
    insufficientPermissions: {
      name: 'Insufficient Permissions',
      message: 'You do not have permission to perform this action',
      code: 'permission/insufficient',
      status: 403,
    },
    subscriptionRequired: {
      name: 'Subscription Required',
      message: 'This feature requires an active subscription',
      code: 'permission/subscription-required',
      status: 403,
    },
    adminOnly: {
      name: 'Admin Only',
      message: 'This action can only be performed by administrators',
      code: 'permission/admin-only',
      status: 403,
    },
  },
  
  // Validation errors
  validationErrors: {
    invalidEmail: {
      name: 'Invalid Email',
      message: 'Please enter a valid email address',
      field: 'email',
      code: 'validation/invalid-email',
      status: 400,
    },
    weakPassword: {
      name: 'Weak Password',
      message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      field: 'password',
      code: 'validation/weak-password',
      status: 400,
    },
    requiredField: {
      name: 'Required Field',
      message: 'This field is required',
      field: 'generic',
      code: 'validation/required-field',
      status: 400,
    },
    invalidDate: {
      name: 'Invalid Date',
      message: 'Please enter a valid date',
      field: 'date',
      code: 'validation/invalid-date',
      status: 400,
    },
    endDateBeforeStartDate: {
      name: 'End Date Before Start Date',
      message: 'End date must be after start date',
      field: 'endDate',
      code: 'validation/end-date-before-start-date',
      status: 400,
    },
  },
  
  // Server errors
  serverErrors: {
    internalServerError: {
      name: 'Internal Server Error',
      message: 'An unexpected error occurred on the server',
      code: 'server/internal-error',
      status: 500,
    },
    databaseError: {
      name: 'Database Error',
      message: 'A database error occurred',
      code: 'server/database-error',
      status: 500,
    },
    serviceUnavailable: {
      name: 'Service Unavailable',
      message: 'The service is temporarily unavailable',
      code: 'server/service-unavailable',
      status: 503,
    },
  },
};

// ====================================
// 8. TEST EDGE CASES
// ====================================

const TEST_EDGE_CASES = {
  // Boundary values
  boundaryValues: {
    maxInteger: Number.MAX_SAFE_INTEGER,
    minInteger: Number.MIN_SAFE_INTEGER,
    maxFloat: Number.MAX_VALUE,
    minFloat: Number.MIN_VALUE,
    epsilon: Number.EPSILON,
    infinity: Infinity,
    negativeInfinity: -Infinity,
    nan: NaN,
  },
  
  // Extreme inputs
  extremeInputs: {
    emptyString: '',
    nullValue: null,
    undefinedValue: undefined,
    veryLongString: 'a'.repeat(10000),
    specialCharactersString: '!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./😀🔥👍🏼🎉🚀',
    htmlString: '<script>alert("XSS")</script><img src="x" onerror="alert(\'XSS\')" />',
    sqlInjectionString: "'; DROP TABLE users; --",
    jsonString: '{"key": "value", "nested": {"key": "value"}}',
    base64String: 'SGVsbG8gV29ybGQ=',
    whitespaceString: '   ',
    newlineString: '\n\n\n',
    zeroWidthString: '\u200B\u200C\u200D\uFEFF',
    emojiString: '😀🔥👍🏼🎉🚀',
  },
  
  // Unexpected user behaviors
  unexpectedBehaviors: {
    rapidButtonClicking: { description: 'User rapidly clicks button multiple times' },
    backNavigationDuringSubmit: { description: 'User navigates back during form submission' },
    appBackgroundedDuringOperation: { description: 'App is backgrounded during operation' },
    networkChangeDuringOperation: { description: 'Network changes from wifi to cellular during operation' },
    lowBatteryDuringOperation: { description: 'Device enters low power mode during operation' },
    deviceRotationDuringOperation: { description: 'Device orientation changes during operation' },
    interruptedByPhoneCall: { description: 'Operation interrupted by incoming phone call' },
    multipleAccountsOnSameDevice: { description: 'Multiple users logging in on same device' },
    clearAppCacheDuringUse: { description: 'App cache is cleared during use' },
    systemDateTimeChanged: { description: 'System date/time is changed during use' },
  },
  
  // Concurrent operations
  concurrentOperations: {
    multipleRequests: { description: 'Multiple API requests sent simultaneously' },
    parallelDownloads: { description: 'Multiple downloads initiated in parallel' },
    simultaneousFormSubmissions: { description: 'Same form submitted multiple times' },
    concurrentEdits: { description: 'Same resource edited by multiple users' },
    raceConditions: { description: 'Operations with potential race conditions' },
  },
  
  // Performance edge cases
  performanceEdgeCases: {
    largeDataLoad: { description: 'Loading extremely large datasets' },
    highLatencyNetwork: { description: 'Operating on very high latency network' },
    lowMemoryDevice: { description: 'Running on device with low available memory' },
    cpuIntensiveBackground: { description: 'Other CPU-intensive apps running in background' },
    thermalThrottling: { description: 'Device experiencing thermal throttling' },
  },
};

// Export all test data
module.exports = {
  TEST_USER_CREDENTIALS,
  TEST_SHOWS_DATA,
  TEST_LOCATIONS,
  TEST_SEARCH_QUERIES,
  TEST_CARDS_DATA,
  TEST_SUBSCRIPTION_DATA,
  TEST_ERROR_SCENARIOS,
  TEST_EDGE_CASES,
  daysFromNow, // Export helper function for date creation
};
