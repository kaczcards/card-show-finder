// e2e/config/segmented-batches.js
/**
 * Segmented E2E Test Batches Configuration
 * Card-Show-Finder · July 2025
 * 
 * This file defines optimized test batches that align with our segmented testing strategy.
 * Each batch is designed to:
 * 1. Run in a reasonable timeframe (3-6 minutes)
 * 2. Test a specific functional area
 * 3. Provide fast, isolated feedback on failures
 * 4. Support parallel execution in CI pipeline
 */

module.exports = {
  /**
   * Batch configuration
   * 
   * Each batch has:
   * - name: Unique identifier for the batch
   * - description: What this batch tests and why
   * - testFiles: Array of test file paths (relative to e2e/tests/)
   * - estimatedTime: Approximate execution time in seconds
   * - tags: Array of tags for filtering/categorization
   * - priority: Execution priority (lower numbers run first)
   * - blocking: Whether failures should block the pipeline
   * - dependencies: Array of batch names that must pass before this batch
   */
  batches: [
    // =========================================
    // AUTH SEGMENT - Authentication & Session
    // =========================================
    {
      name: "auth",
      description: "Critical authentication flows (login, registration, logout)",
      testFiles: [
        "auth/login.test.js",
        "auth/registration.test.js",
        "auth/logout.test.js"
      ],
      estimatedTime: 180, // 3 minutes
      tags: ["auth", "critical-path", "smoke"],
      priority: 1,
      blocking: true,
      dependencies: []
    },
    {
      name: "auth-extended",
      description: "Extended authentication (password reset, session persistence)",
      testFiles: [
        "auth/password-reset.test.js",
        "auth/session-persistence.test.js"
      ],
      estimatedTime: 120, // 2 minutes
      tags: ["auth", "critical-path"],
      priority: 2,
      blocking: true,
      dependencies: ["auth"]
    },
    {
      name: "auth-edge",
      description: "Authentication edge cases and error handling",
      testFiles: [
        "auth/error-handling.test.js"
      ],
      estimatedTime: 150, // 2.5 minutes
      tags: ["auth", "error-handling"],
      priority: 3,
      blocking: false,
      dependencies: ["auth"]
    },

    // =========================================
    // CORE SEGMENT - Main App Functionality
    // =========================================
    {
      name: "core-browse",
      description: "Card show browsing and search functionality",
      testFiles: [
        "browse/search.test.js",
        "browse/filters.test.js",
        "browse/list-view.test.js"
      ],
      estimatedTime: 210, // 3.5 minutes
      tags: ["core", "critical-path", "smoke"],
      priority: 4,
      blocking: true,
      dependencies: ["auth"]
    },
    {
      name: "core-maps",
      description: "Map view, location services, and directions",
      testFiles: [
        "maps/map-view.test.js",
        "maps/location-services.test.js",
        "maps/directions.test.js"
      ],
      estimatedTime: 240, // 4 minutes
      tags: ["core", "maps", "critical-path"],
      priority: 5,
      blocking: true,
      dependencies: ["core-browse"]
    },
    {
      name: "core-crud",
      description: "Create, read, update, delete operations for card shows",
      testFiles: [
        "crud/create-show.test.js",
        "crud/edit-show.test.js",
        "crud/delete-show.test.js"
      ],
      estimatedTime: 270, // 4.5 minutes
      tags: ["core", "data", "critical-path"],
      priority: 6,
      blocking: true,
      dependencies: ["auth"]
    },

    // =========================================
    // EDGE SEGMENT - Edge Cases & Resilience
    // =========================================
    {
      name: "edge-offline",
      description: "Offline mode and network resilience",
      testFiles: [
        "edge/offline-mode.test.js",
        "edge/network-recovery.test.js"
      ],
      estimatedTime: 180, // 3 minutes
      tags: ["edge", "offline", "resilience"],
      priority: 7,
      blocking: false,
      dependencies: ["core-browse", "core-maps"]
    },
    {
      name: "edge-errors",
      description: "Error states and boundary conditions",
      testFiles: [
        "edge/error-states.test.js",
        "edge/boundary-conditions.test.js"
      ],
      estimatedTime: 150, // 2.5 minutes
      tags: ["edge", "error-handling"],
      priority: 8,
      blocking: false,
      dependencies: ["core-crud"]
    },
    {
      name: "edge-stress",
      description: "Stress tests and rapid user interactions",
      testFiles: [
        "edge/rapid-navigation.test.js",
        "edge/memory-pressure.test.js",
        "edge/concurrent-operations.test.js"
      ],
      estimatedTime: 300, // 5 minutes
      tags: ["edge", "stress", "performance"],
      priority: 9,
      blocking: false,
      dependencies: ["core-browse", "core-maps", "core-crud"]
    },

    // =========================================
    // PERFORMANCE SEGMENT - Metrics & Benchmarks
    // =========================================
    {
      name: "perf-startup",
      description: "App startup time and initial render performance",
      testFiles: [
        "performance/startup-time.test.js",
        "performance/initial-render.test.js"
      ],
      estimatedTime: 120, // 2 minutes
      tags: ["performance", "startup"],
      priority: 10,
      blocking: false,
      dependencies: []
    },
    {
      name: "perf-navigation",
      description: "Navigation performance and screen transitions",
      testFiles: [
        "performance/navigation-timing.test.js",
        "performance/transitions.test.js"
      ],
      estimatedTime: 150, // 2.5 minutes
      tags: ["performance", "navigation"],
      priority: 11,
      blocking: false,
      dependencies: ["perf-startup"]
    },
    {
      name: "perf-data",
      description: "Data operations performance (load, save, query)",
      testFiles: [
        "performance/data-loading.test.js",
        "performance/query-performance.test.js",
        "performance/save-operations.test.js"
      ],
      estimatedTime: 180, // 3 minutes
      tags: ["performance", "data"],
      priority: 12,
      blocking: false,
      dependencies: ["perf-startup"]
    }
  ],

  /**
   * Composite segments that combine multiple batches
   * for convenient execution
   */
  segments: {
    // Critical path tests - must pass for PR approval
    "critical": [
      "auth",
      "auth-extended",
      "core-browse",
      "core-maps",
      "core-crud"
    ],
    
    // All auth-related tests
    "auth-all": [
      "auth",
      "auth-extended",
      "auth-edge"
    ],
    
    // All core functionality tests
    "core-all": [
      "core-browse",
      "core-maps",
      "core-crud"
    ],
    
    // All edge case tests
    "edge-all": [
      "edge-offline",
      "edge-errors",
      "edge-stress"
    ],
    
    // All performance tests
    "perf-all": [
      "perf-startup",
      "perf-navigation",
      "perf-data"
    ],
    
    // Smoke test - fastest validation of key functionality
    "smoke": [
      "auth",
      "core-browse"
    ],
    
    // Full regression test - everything
    "full": [
      "auth",
      "auth-extended",
      "auth-edge",
      "core-browse",
      "core-maps",
      "core-crud",
      "edge-offline",
      "edge-errors",
      "edge-stress",
      "perf-startup",
      "perf-navigation",
      "perf-data"
    ]
  },

  /**
   * Helper functions for batch management
   */
  getSegmentBatches(segmentName) {
    return this.segments[segmentName] || [];
  },
  
  getBatchByName(batchName) {
    return this.batches.find(batch => batch.name === batchName);
  },
  
  getEstimatedTime(batchNames) {
    return batchNames.reduce((total, batchName) => {
      const batch = this.getBatchByName(batchName);
      return total + (batch ? batch.estimatedTime : 0);
    }, 0);
  },
  
  getDependencyTree(batchName, visited = new Set()) {
    const batch = this.getBatchByName(batchName);
    if (!batch || visited.has(batchName)) return [];
    
    visited.add(batchName);
    const dependencies = [];
    
    for (const dep of batch.dependencies) {
      dependencies.push(dep);
      dependencies.push(...this.getDependencyTree(dep, visited));
    }
    
    return [...new Set(dependencies)];
  },
  
  getExecutionOrder(batchNames) {
    // Build dependency graph
    const graph = {};
    const batches = [...new Set(batchNames)];
    
    for (const batchName of batches) {
      const deps = this.getDependencyTree(batchName);
      graph[batchName] = deps;
    }
    
    // Topological sort
    const result = [];
    const visited = new Set();
    const temp = new Set();
    
    function visit(node) {
      if (temp.has(node)) throw new Error(`Circular dependency detected: ${node}`);
      if (visited.has(node)) return;
      
      temp.add(node);
      for (const dep of graph[node] || []) {
        visit(dep);
      }
      temp.delete(node);
      visited.add(node);
      result.push(node);
    }
    
    for (const node of batches) {
      if (!visited.has(node)) {
        visit(node);
      }
    }
    
    return result;
  }
};
