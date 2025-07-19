// e2e/artifacts/pathbuilder.js
const path = require('path');
const fs = require('fs');

/**
 * Sanitize a string to be used as a filename
 * Replaces invalid characters with underscores
 * 
 * @param {string} name - String to sanitize
 * @returns {string} - Sanitized string safe for filenames
 */
function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') {
    return 'unknown';
  }

  // Replace invalid filename characters with underscores
  // and limit length to prevent extremely long paths
  return name
    .replace(/[\\/:*?"<>|]/g, '_') // Replace invalid chars
    .replace(/\s+/g, '_')          // Replace spaces with underscores
    .replace(/__+/g, '_')          // Replace multiple underscores with single
    .substring(0, 100)             // Limit length
    .trim();
}

/**
 * Custom path builder for Detox artifacts
 * Organizes artifacts by test suite, test name, and timestamp
 */
class DetoxPathBuilder {
  /**
   * Build a path for a test artifact
   * 
   * @param {Object} testSummary - Summary of the test
   * @param {string} artifactName - Name of the artifact
   * @param {string} artifactExtension - Extension of the artifact (with dot)
   * @returns {string} - Path where the artifact should be stored
   */
  buildPathForTestArtifact(testSummary, artifactName, artifactExtension = '') {
    // Get root directory from environment or use default
    const rootDir = process.env.DETOX_ARTIFACTS_PATH || path.join(process.cwd(), 'e2e', 'artifacts');
    
    // Ensure artifacts directory exists
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }

    // Get current timestamp for unique file naming
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '');

    // Extract test information
    const { title, fullName, status } = testSummary || {};
    
    // Get test suite name (first part of the fullName if available)
    let testSuite = 'unknown-suite';
    if (fullName && Array.isArray(fullName) && fullName.length > 0) {
      testSuite = sanitizeFileName(fullName[0]);
    }
    
    // Get test name (last part of the fullName if available, or title)
    let testName = 'unknown-test';
    if (title) {
      testName = sanitizeFileName(title);
    } else if (fullName && Array.isArray(fullName) && fullName.length > 1) {
      testName = sanitizeFileName(fullName[fullName.length - 1]);
    }

    // Get test status (passed, failed, etc.)
    const testStatus = status || 'unknown';

    // Create artifact type directory based on extension or name
    let artifactType = 'misc';
    if (artifactExtension) {
      switch (artifactExtension.toLowerCase()) {
        case '.png':
        case '.jpg':
        case '.jpeg':
          artifactType = 'screenshots';
          break;
        case '.mp4':
        case '.mov':
          artifactType = 'videos';
          break;
        case '.log':
          artifactType = 'logs';
          break;
        case '.json':
          artifactType = 'reports';
          break;
        default:
          artifactType = 'misc';
      }
    } else if (artifactName) {
      if (artifactName.includes('log')) {
        artifactType = 'logs';
      } else if (artifactName.includes('screenshot')) {
        artifactType = 'screenshots';
      } else if (artifactName.includes('video')) {
        artifactType = 'videos';
      } else if (artifactName.includes('report') || artifactName.includes('timeline')) {
        artifactType = 'reports';
      }
    }

    // Build directory structure: rootDir/artifactType/testSuite/testName/
    const artifactDir = path.join(
      rootDir,
      artifactType,
      testSuite,
      testName
    );

    // Ensure the directory exists
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Create filename with test status and timestamp
    const filename = [
      testName,
      testStatus,
      timestamp,
      artifactName
    ]
      .filter(Boolean)
      .join('_');

    // Return the full path
    return path.join(artifactDir, `${filename}${artifactExtension}`);
  }
}

/**
 * Export an instance of the path builder for Detox to use
 */
module.exports = new DetoxPathBuilder();
