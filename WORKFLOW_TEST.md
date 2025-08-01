# 🚀 CI/CD & Security Workflow Test

This file exists **solely to trigger** the three GitHub Actions workflows for Card Show Finder.

**Workflows being exercised**
1. **CI (Continuous Integration)**  
   • Runs linting, TypeScript type-checks, unit tests, and secret-scan on every commit.

2. **CD (Continuous Deployment)**  
   • Builds the Expo app with EAS, submits iOS & Android builds (staging/production), runs DB migration checks, and publishes OTA updates.

3. **Security Scanning**  
   • Executes dependency-vulnerability scan, SQL migration security audit, and secret-leak detection across the repository.

---

**Purpose:** Validate our **end-to-end pipeline**—from code quality to deployment and security.

**Timestamp:** 2025-08-01T00:00:00Z

_Adding this file should automatically kick off all three workflows and confirm they pass without errors._
