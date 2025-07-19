// e2e/config/batches.js
/**
 * E2E Test Batches Configuration
 * 
 * This file defines batches of tests that can be run independently.
 * Each batch is designed to run in approximately 1 hour to allow for
 * better progress tracking and more manageable test runs.
 */

module.exports = {
  /**
   * Batch configuration
   * 
   * Each batch has:
   * - name: Descriptive name for the batch
   * - description: Detailed information about what's being tested
   * - testFiles: Array of test file paths (relative to e2e/tests/)
   * - estimatedTime: Approximate execution time in minutes
   * - tags: Array of tags for filtering/categorization
   * - priority: Execution priority (lower numbers run first)
   */
  batches: [
    // =========================================
    // BATCH 1: Basic Authentication Flows
    // =========================================
    {
      name: "auth-basic",
      description: "Basic authentication flows including registration and login",
      testFiles: [
        "auth/registration.test.js",
        "auth/login.test.js",
        "auth/logout.test.js"
      ],
      estimatedTime: 45, // minutes
      tags: ["auth", "critical-path", "smoke"],
      priority: 1
    },
    
    // =========================================
    // BATCH 2: Advanced Authentication Flows
    // =========================================
    {
      name: "auth-advanced",
      description: "Advanced authentication flows including password reset and session management",
      testFiles: [
        "auth/password-reset.test.js",
        "auth/session-persistence.test.js",
        "auth/error-handling.test.js"
      ],
      estimatedTime: 50, // minutes
      tags: ["auth", "security"],
      priority: 2
    },
    
    // =========================================
    // BATCH 3: Home & Navigation (Future)
    // =========================================
    {
      name: "home-navigation",
      description: "Home screen functionality and app navigation",
      testFiles: [
        // These files will be created in future PRs
        "home/home-screen.test.js",
        "home/navigation.test.js",
        "home/deep-linking.test.js"
      ],
      estimatedTime: 40, // minutes
      tags: ["ui", "navigation"],
      priority: 3,
      status: "planned" // Indicates these tests don't exist yet
    },
    
    // =========================================
    // BATCH 4: Show Listings & Filtering (Future)
    // =========================================
    {
      name: "show-listings",
      description: "Show listings, search, and filtering functionality",
      testFiles: [
        // These files will be created in future PRs
        "shows/show-list.test.js",
        "shows/filtering.test.js",
        "shows/search.test.js"
      ],
      estimatedTime: 55, // minutes
      tags: ["shows", "search"],
      priority: 4,
      status: "planned"
    },
    
    // =========================================
    // BATCH 5: Show Details & Interactions (Future)
    // =========================================
    {
      name: "show-details",
      description: "Show details page and user interactions",
      testFiles: [
        // These files will be created in future PRs
        "shows/show-details.test.js",
        "shows/favorites.test.js",
        "shows/sharing.test.js"
      ],
      estimatedTime: 45, // minutes
      tags: ["shows", "interaction"],
      priority: 5,
      status: "planned"
    },
    
    // =========================================
    // BATCH 6: Map View & Geolocation (Future)
    // =========================================
    {
      name: "map-geolocation",
      description: "Map view, clustering, and geolocation features",
      testFiles: [
        // These files will be created in future PRs
        "map/map-view.test.js",
        "map/clustering.test.js",
        "map/geolocation.test.js"
      ],
      estimatedTime: 60, // minutes
      tags: ["map", "location"],
      priority: 6,
      status: "planned"
    },
    
    // =========================================
    // BATCH 7: User Profile & Settings (Future)
    // =========================================
    {
      name: "profile-settings",
      description: "User profile, preferences, and settings",
      testFiles: [
        // These files will be created in future PRs
        "profile/user-profile.test.js",
        "profile/settings.test.js",
        "profile/preferences.test.js"
      ],
      estimatedTime: 40, // minutes
      tags: ["profile", "settings"],
      priority: 7,
      status: "planned"
    },
    
    // =========================================
    // BATCH 8: Dealer & MVP Features (Future)
    // =========================================
    {
      name: "dealer-features",
      description: "Dealer-specific and MVP subscription features",
      testFiles: [
        // These files will be created in future PRs
        "dealer/dealer-profile.test.js",
        "dealer/mvp-features.test.js",
        "dealer/subscriptions.test.js"
      ],
      estimatedTime: 50, // minutes
      tags: ["dealer", "subscription"],
      priority: 8,
      status: "planned"
    }
  ],
  
  // Helper functions to work with batches
  getBatchByName: function(batchName) {
    return this.batches.find(batch => batch.name === batchName);
  },
  
  getActiveBatches: function() {
    return this.batches.filter(batch => batch.status !== "planned");
  },
  
  getBatchesByTag: function(tag) {
    return this.batches.filter(batch => batch.tags.includes(tag));
  },
  
  // Get test files for a specific batch
  getTestFilesForBatch: function(batchName) {
    const batch = this.getBatchByName(batchName);
    return batch ? batch.testFiles : [];
  },
  
  // Get all test files for multiple batches
  getTestFilesForBatches: function(batchNames) {
    let testFiles = [];
    batchNames.forEach(batchName => {
      testFiles = testFiles.concat(this.getTestFilesForBatch(batchName));
    });
    return testFiles;
  },
  
  // Get estimated total runtime for a set of batches (in minutes)
  getEstimatedRuntime: function(batchNames) {
    let totalTime = 0;
    batchNames.forEach(batchName => {
      const batch = this.getBatchByName(batchName);
      if (batch) {
        totalTime += batch.estimatedTime;
      }
    });
    return totalTime;
  }
};
