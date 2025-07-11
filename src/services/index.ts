/**
 * Services index file
 * 
 * This file re-exports all services from the services directory to make imports cleaner.
 * Instead of importing each service individually like:
 *   import * as supabaseAuthService from '../services/supabaseAuthService';
 *   import * as userRoleService from '../services/userRoleService';
 * 
 * You can now import them like:
 *   import { supabaseAuthService, userRoleService } from '../services';
 */

// Authentication services
export * as supabaseAuthService from './supabaseAuthService';

// Session / token utilities
export * as sessionService from './sessionService';

// User role and permissions
export * as userRoleService from './userRoleService';

// Error handling service
export * from './errorService';

// Messaging services
export * as messagingService from './messagingService';

// Any other services should be exported here
// export * as exampleService from './exampleService';
