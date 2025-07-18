/**
 * Web Application Firewall (WAF) Middleware for Supabase Edge Functions
 * 
 * This module provides protection against common web application attacks:
 * - SQL Injection
 * - Cross-Site Scripting (XSS)
 * - Command Injection
 * - Path Traversal
 * - Server-Side Request Forgery (SSRF)
 * - HTTP Header Injection
 * - Request Parameter Validation
 * - Rate Limiting Integration
 * 
 * Based on OWASP Top 10 security risks and best practices.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

/**
 * WAF protection level
 */
export enum WafProtectionLevel {
  /** Basic protection for non-sensitive endpoints */
  LOW = "low",
  /** Standard protection for most endpoints */
  MEDIUM = "medium",
  /** Enhanced protection for sensitive endpoints */
  HIGH = "high",
  /** Maximum protection for critical endpoints */
  MAXIMUM = "maximum"
}

/**
 * WAF configuration
 */
export interface WafConfig {
  /** Protection level */
  protectionLevel: WafProtectionLevel;
  /** Whether to block requests or just log them */
  blockMode: boolean;
  /** Whether to log detected attacks */
  enableLogging: boolean;
  /** Custom rules to apply */
  customRules?: WafRule[];
  /** Whether to validate request parameters */
  validateParams: boolean;
  /** Whether to validate request headers */
  validateHeaders: boolean;
  /** Whether to validate request body */
  validateBody: boolean;
  /** Trusted IP addresses that bypass WAF */
  trustedIps?: string[];
  /** Trusted user agents that bypass WAF */
  trustedUserAgents?: string[];
}

/**
 * WAF rule
 */
export interface WafRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Regular expression pattern to match */
  pattern: RegExp;
  /** Locations to check (query, body, headers, cookies, path) */
  locations: string[];
  /** Minimum protection level to apply this rule */
  minLevel: WafProtectionLevel;
  /** OWASP category */
  category: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Whether to block the request if matched */
  block: boolean;
}

/**
 * Attack detection result
 */
export interface AttackDetectionResult {
  /** Whether an attack was detected */
  detected: boolean;
  /** Matched rule if attack was detected */
  rule?: WafRule;
  /** Location where attack was detected */
  location?: string;
  /** Value that triggered the detection */
  value?: string;
}

/**
 * WAF log entry
 */
export interface WafLogEntry {
  /** Request ID */
  request_id: string;
  /** Timestamp */
  timestamp: string;
  /** IP address */
  ip_address: string;
  /** User ID if authenticated */
  user_id?: string;
  /** Request method */
  method: string;
  /** Request path */
  path: string;
  /** User agent */
  user_agent?: string;
  /** Attack type */
  attack_type: string;
  /** Rule ID that detected the attack */
  rule_id: string;
  /** Rule name */
  rule_name: string;
  /** Location where attack was detected */
  location: string;
  /** Value that triggered the detection */
  value: string;
  /** Action taken (block, log) */
  action: string;
  /** Protection level */
  protection_level: string;
  /** Severity */
  severity: string;
  /** Request headers (sanitized) */
  headers?: Record<string, string>;
  /** Request parameters (sanitized) */
  params?: Record<string, string>;
}

/**
 * Default WAF rules
 */
export const DEFAULT_WAF_RULES: WafRule[] = [
  // SQL Injection
  {
    id: "sqli-001",
    name: "SQL Injection - Basic",
    description: "Detects basic SQL injection attempts",
    pattern: /('|%27)(\s)*(or|and|union|select|insert|update|delete|drop|alter|truncate|declare|exec|dbms_|sp_|xp_|sysobjects|syscolumns|information_schema)/i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.LOW,
    category: "Injection",
    severity: "high",
    block: true
  },
  {
    id: "sqli-002",
    name: "SQL Injection - Advanced",
    description: "Detects more advanced SQL injection patterns",
    pattern: /((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Injection",
    severity: "high",
    block: true
  },
  {
    id: "sqli-003",
    name: "SQL Injection - Comments",
    description: "Detects SQL comment-based injection",
    pattern: /(\/\*|--|\{|;)/i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.HIGH,
    category: "Injection",
    severity: "medium",
    block: true
  },
  
  // XSS (Cross-Site Scripting)
  {
    id: "xss-001",
    name: "XSS - Basic Script Tags",
    description: "Detects basic XSS using script tags",
    pattern: /<script[^>]*>.*?<\/script>/i,
    locations: ["query", "body", "headers"],
    minLevel: WafProtectionLevel.LOW,
    category: "XSS",
    severity: "high",
    block: true
  },
  {
    id: "xss-002",
    name: "XSS - Event Handlers",
    description: "Detects XSS using event handlers",
    pattern: /on(load|mouse|error|click|focus|blur|change|submit|select|key|drag|drop|touch|scroll|resize|abort|play|pause|seek|waiting|ended|rate|volume|time|start|finish|bounce|begin|end|over|out|enter|leave|move|stop|context|media|animation|transition|can|cut|copy|paste|toggle|drag|drop|play|pause|seek|scroll|wheel|pointer|touch|key|composition|selection|storage|popstate|hash|online|offline|page|visibility|language|orientation|device|connection|bluetooth|usb|gamepad|midi|clipboard|share|fullscreen|screen|wake|idle|lock|unlock|ambient|beacon|fetch|install|app|push|notification|permission|presentation|remote|voice|speech|idle|visibility|pointer|gamepad|usb|bluetooth|battery|network|online|offline|storage|quota|persist|animation|transition|speech|voice|media|device|screen|orientation|motion|proximity|ambient|light|temperature|humidity|pressure|proximity|gravity|accelerometer|gyroscope|magnetometer|devicemotion|deviceorientation|compassneedscalibration|userproximity|devicelight|devicetemperature|devicepressure|devicehumidity|deviceproximity|devicegravity|deviceaccelerometer|devicegyroscope|devicemagnetometer|devicemotion|deviceorientation|compassneedscalibration|userproximity|devicelight|devicetemperature|devicepressure|devicehumidity|deviceproximity|devicegravity|deviceaccelerometer|devicegyroscope|devicemagnetometer|devicemotion|deviceorientation|compassneedscalibration|userproximity|devicelight|devicetemperature|devicepressure|devicehumidity|deviceproximity|devicegravity|deviceaccelerometer|devicegyroscope|devicemagnetometer)[^=]*=/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "XSS",
    severity: "high",
    block: true
  },
  {
    id: "xss-003",
    name: "XSS - JavaScript URI",
    description: "Detects JavaScript URI XSS vectors",
    pattern: /javascript:|data:text\/html|vbscript:|livescript:|mocha:|feed:|about:/i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "XSS",
    severity: "high",
    block: true
  },
  {
    id: "xss-004",
    name: "XSS - Encoded Tags",
    description: "Detects encoded XSS attempts",
    pattern: /((%3C)|<)((%2F)|\/)*[a-z0-9%]+((%3E)|>)/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.HIGH,
    category: "XSS",
    severity: "medium",
    block: true
  },
  
  // Path Traversal
  {
    id: "path-001",
    name: "Path Traversal - Basic",
    description: "Detects basic directory traversal attempts",
    pattern: /\.\.\//i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.LOW,
    category: "Path Traversal",
    severity: "high",
    block: true
  },
  {
    id: "path-002",
    name: "Path Traversal - Encoded",
    description: "Detects encoded directory traversal attempts",
    pattern: /%2e%2e\//i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Path Traversal",
    severity: "high",
    block: true
  },
  {
    id: "path-003",
    name: "Path Traversal - Windows",
    description: "Detects Windows-specific path traversal",
    pattern: /\.\.\\/i,
    locations: ["query", "body", "path"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Path Traversal",
    severity: "high",
    block: true
  },
  
  // Command Injection
  {
    id: "cmd-001",
    name: "Command Injection - Basic",
    description: "Detects basic command injection attempts",
    pattern: /;|\||`|&&|\$\(|\$\{/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.LOW,
    category: "Command Injection",
    severity: "critical",
    block: true
  },
  {
    id: "cmd-002",
    name: "Command Injection - Advanced",
    description: "Detects more advanced command injection",
    pattern: /system\s*\(|exec\s*\(|passthru\s*\(|shell_exec\s*\(|popen\s*\(|proc_open\s*\(|pcntl_exec\s*\(/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Command Injection",
    severity: "critical",
    block: true
  },
  
  // SSRF (Server-Side Request Forgery)
  {
    id: "ssrf-001",
    name: "SSRF - Internal IP",
    description: "Detects SSRF attempts targeting internal networks",
    pattern: /(127\.0\.0\.1|localhost|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "SSRF",
    severity: "high",
    block: true
  },
  {
    id: "ssrf-002",
    name: "SSRF - Protocol Handlers",
    description: "Detects SSRF attempts using non-HTTP protocols",
    pattern: /(file|gopher|dict|ftp|ldap|tftp|ssh):/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "SSRF",
    severity: "high",
    block: true
  },
  
  // HTTP Header Injection
  {
    id: "header-001",
    name: "HTTP Header Injection",
    description: "Detects HTTP header injection attempts",
    pattern: /[\r\n]/i,
    locations: ["headers"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Header Injection",
    severity: "medium",
    block: true
  },
  
  // CSRF Token Validation
  {
    id: "csrf-001",
    name: "Missing CSRF Token",
    description: "Detects requests without CSRF token for state-changing operations",
    pattern: /^$/i, // Custom logic handles this
    locations: ["headers"],
    minLevel: WafProtectionLevel.HIGH,
    category: "CSRF",
    severity: "medium",
    block: false // Handled separately
  },
  
  // Content-Type Validation
  {
    id: "content-001",
    name: "Invalid Content-Type",
    description: "Detects requests with suspicious content types",
    pattern: /^$/i, // Custom logic handles this
    locations: ["headers"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "Content Validation",
    severity: "low",
    block: false // Handled separately
  },
  
  // Insecure Deserialization
  {
    id: "deserial-001",
    name: "PHP Object Injection",
    description: "Detects PHP Object Injection attempts",
    pattern: /O:[0-9]+:"[^"]+":[0-9]+:\{/i,
    locations: ["body"],
    minLevel: WafProtectionLevel.HIGH,
    category: "Insecure Deserialization",
    severity: "high",
    block: true
  },
  
  // NoSQL Injection
  {
    id: "nosql-001",
    name: "NoSQL Injection - MongoDB",
    description: "Detects MongoDB injection attempts",
    pattern: /\$where|\$ne|\$gt|\$lt|\$regex|\$exists|\$elemMatch|\$all|\$in|\$nin|\$or|\$and|\$not|\$nor/i,
    locations: ["query", "body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "NoSQL Injection",
    severity: "high",
    block: true
  },
  
  // XML External Entity (XXE)
  {
    id: "xxe-001",
    name: "XXE - DOCTYPE",
    description: "Detects XXE using DOCTYPE declaration",
    pattern: /<!DOCTYPE[^>]*SYSTEM[^>]*>/i,
    locations: ["body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "XXE",
    severity: "high",
    block: true
  },
  {
    id: "xxe-002",
    name: "XXE - Entity",
    description: "Detects XXE using ENTITY declaration",
    pattern: /<!ENTITY[^>]*SYSTEM[^>]*>/i,
    locations: ["body"],
    minLevel: WafProtectionLevel.MEDIUM,
    category: "XXE",
    severity: "high",
    block: true
  }
];

/**
 * Default WAF configuration by protection level
 */
export const DEFAULT_WAF_CONFIG: Record<WafProtectionLevel, WafConfig> = {
  [WafProtectionLevel.LOW]: {
    protectionLevel: WafProtectionLevel.LOW,
    blockMode: true,
    enableLogging: true,
    validateParams: true,
    validateHeaders: false,
    validateBody: false
  },
  [WafProtectionLevel.MEDIUM]: {
    protectionLevel: WafProtectionLevel.MEDIUM,
    blockMode: true,
    enableLogging: true,
    validateParams: true,
    validateHeaders: true,
    validateBody: true
  },
  [WafProtectionLevel.HIGH]: {
    protectionLevel: WafProtectionLevel.HIGH,
    blockMode: true,
    enableLogging: true,
    validateParams: true,
    validateHeaders: true,
    validateBody: true
  },
  [WafProtectionLevel.MAXIMUM]: {
    protectionLevel: WafProtectionLevel.MAXIMUM,
    blockMode: true,
    enableLogging: true,
    validateParams: true,
    validateHeaders: true,
    validateBody: true
  }
};

/**
 * Web Application Firewall class
 */
export class WebApplicationFirewall {
  private supabase: SupabaseClient;
  private logTableName: string;
  private rules: WafRule[];
  
  /**
   * Create a new WAF instance
   * @param supabaseUrl - Supabase URL
   * @param supabaseKey - Supabase service role key
   * @param logTableName - Table name for WAF logs
   * @param customRules - Custom rules to add to default rules
   */
  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    logTableName = "waf_logs",
    customRules: WafRule[] = []
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logTableName = logTableName;
    this.rules = [...DEFAULT_WAF_RULES, ...customRules];
  }

  /**
   * Check if a request is allowed by WAF rules
   * @param req - Request object
   * @param config - WAF configuration
   * @param userId - User ID if authenticated
   * @returns Attack detection result
   */
  async checkRequest(
    req: Request,
    config: WafConfig,
    userId?: string
  ): Promise<AttackDetectionResult> {
    // Generate a unique request ID
    const requestId = crypto.randomUUID();
    
    // Extract IP address and user agent
    const ipAddress = req.headers.get("CF-Connecting-IP") || 
                      req.headers.get("X-Forwarded-For") || 
                      "unknown";
    const userAgent = req.headers.get("User-Agent") || "unknown";
    
    // Check if IP or user agent is trusted
    if (config.trustedIps?.includes(ipAddress as string) || 
        config.trustedUserAgents?.some(ua => userAgent.includes(ua))) {
      return { detected: false };
    }
    
    // Parse URL and method
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;
    
    // Extract query parameters
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    // Extract headers
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    
    // Extract body if needed
    let body: any = {};
    if (config.validateBody && req.method !== "GET" && req.method !== "HEAD") {
      try {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const clonedReq = req.clone();
          body = await clonedReq.json();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const clonedReq = req.clone();
          const text = await clonedReq.text();
          const params = new URLSearchParams(text);
          params.forEach((value, key) => {
            body[key] = value;
          });
        }
      } catch (error) {
        console.error("Error parsing request body:", error);
      }
    }
    
    // Check rules based on protection level
    for (const rule of this.rules) {
      // Skip rules that don't apply to the current protection level
      if (this.getProtectionLevelValue(rule.minLevel) > 
          this.getProtectionLevelValue(config.protectionLevel)) {
        continue;
      }
      
      // Check each location specified in the rule
      for (const location of rule.locations) {
        let valuesToCheck: Record<string, string> = {};
        
        switch (location) {
          case "query":
            valuesToCheck = queryParams;
            break;
          case "body":
            valuesToCheck = this.flattenObject(body);
            break;
          case "headers":
            valuesToCheck = headers;
            break;
          case "path":
            valuesToCheck = { path };
            break;
          default:
            continue;
        }
        
        // Check each value against the rule pattern
        for (const [key, value] of Object.entries(valuesToCheck)) {
          if (typeof value === "string" && rule.pattern.test(value)) {
            // Attack detected
            const result: AttackDetectionResult = {
              detected: true,
              rule,
              location: `${location}:${key}`,
              value: this.sanitizeValue(value)
            };
            
            // Log the attack if logging is enabled
            if (config.enableLogging) {
              await this.logAttack({
                request_id: requestId,
                timestamp: new Date().toISOString(),
                ip_address: ipAddress as string,
                user_id: userId,
                method,
                path,
                user_agent: userAgent as string,
                attack_type: rule.category,
                rule_id: rule.id,
                rule_name: rule.name,
                location: `${location}:${key}`,
                value: this.sanitizeValue(value),
                action: config.blockMode ? "block" : "log",
                protection_level: config.protectionLevel,
                severity: rule.severity,
                headers: this.sanitizeHeaders(headers),
                params: this.sanitizeObject(queryParams)
              });
            }
            
            return result;
          }
        }
      }
    }
    
    // Additional validations for higher protection levels
    if (config.protectionLevel === WafProtectionLevel.HIGH || 
        config.protectionLevel === WafProtectionLevel.MAXIMUM) {
      
      // CSRF token validation for state-changing methods
      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const csrfToken = req.headers.get("x-csrf-token") || 
                          req.headers.get("x-xsrf-token");
        
        if (!csrfToken && config.blockMode) {
          const rule = this.rules.find(r => r.id === "csrf-001");
          if (rule) {
            // Log the attack if logging is enabled
            if (config.enableLogging) {
              await this.logAttack({
                request_id: requestId,
                timestamp: new Date().toISOString(),
                ip_address: ipAddress as string,
                user_id: userId,
                method,
                path,
                user_agent: userAgent as string,
                attack_type: "CSRF",
                rule_id: "csrf-001",
                rule_name: "Missing CSRF Token",
                location: "headers:x-csrf-token",
                value: "missing",
                action: config.blockMode ? "block" : "log",
                protection_level: config.protectionLevel,
                severity: "medium",
                headers: this.sanitizeHeaders(headers),
                params: this.sanitizeObject(queryParams)
              });
            }
            
            return {
              detected: true,
              rule,
              location: "headers:x-csrf-token",
              value: "missing"
            };
          }
        }
      }
      
      // Content-Type validation
      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const contentType = req.headers.get("content-type") || "";
        const validContentTypes = [
          "application/json",
          "application/x-www-form-urlencoded",
          "multipart/form-data"
        ];
        
        if (!validContentTypes.some(vct => contentType.includes(vct)) && config.blockMode) {
          const rule = this.rules.find(r => r.id === "content-001");
          if (rule) {
            // Log the attack if logging is enabled
            if (config.enableLogging) {
              await this.logAttack({
                request_id: requestId,
                timestamp: new Date().toISOString(),
                ip_address: ipAddress as string,
                user_id: userId,
                method,
                path,
                user_agent: userAgent as string,
                attack_type: "Content Validation",
                rule_id: "content-001",
                rule_name: "Invalid Content-Type",
                location: "headers:content-type",
                value: contentType,
                action: config.blockMode ? "block" : "log",
                protection_level: config.protectionLevel,
                severity: "low",
                headers: this.sanitizeHeaders(headers),
                params: this.sanitizeObject(queryParams)
              });
            }
            
            return {
              detected: true,
              rule,
              location: "headers:content-type",
              value: contentType
            };
          }
        }
      }
      
      // Maximum protection level additional validations
      if (config.protectionLevel === WafProtectionLevel.MAXIMUM) {
        // Validate Accept header
        const accept = req.headers.get("accept");
        if (!accept && config.blockMode) {
          const rule = {
            id: "header-002",
            name: "Missing Accept Header",
            description: "Detects requests without Accept header",
            pattern: /^$/i,
            locations: ["headers"],
            minLevel: WafProtectionLevel.MAXIMUM,
            category: "Header Validation",
            severity: "low",
            block: true
          };
          
          // Log the attack if logging is enabled
          if (config.enableLogging) {
            await this.logAttack({
              request_id: requestId,
              timestamp: new Date().toISOString(),
              ip_address: ipAddress as string,
              user_id: userId,
              method,
              path,
              user_agent: userAgent as string,
              attack_type: "Header Validation",
              rule_id: "header-002",
              rule_name: "Missing Accept Header",
              location: "headers:accept",
              value: "missing",
              action: config.blockMode ? "block" : "log",
              protection_level: config.protectionLevel,
              severity: "low",
              headers: this.sanitizeHeaders(headers),
              params: this.sanitizeObject(queryParams)
            });
          }
          
          return {
            detected: true,
            rule,
            location: "headers:accept",
            value: "missing"
          };
        }
      }
    }
    
    // No attack detected
    return { detected: false };
  }
  
  /**
   * Apply WAF middleware to a request
   * @param req - Request object
   * @param configLevel - Protection level or custom config
   * @param userId - User ID if authenticated
   * @returns Response if blocked, null otherwise
   */
  async protect(
    req: Request,
    configLevel: WafProtectionLevel | WafConfig = WafProtectionLevel.MEDIUM,
    userId?: string
  ): Promise<Response | null> {
    // Get configuration
    const config = typeof configLevel === "string" 
      ? DEFAULT_WAF_CONFIG[configLevel]
      : configLevel;
    
    // Check request against WAF rules
    const result = await this.checkRequest(req, config, userId);
    
    // If attack detected and block mode is enabled, return 403 response
    if (result.detected && result.rule?.block && config.blockMode) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Request blocked by security rules",
          code: result.rule?.id || "WAF_BLOCK"
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
    
    // Not blocked, return null to continue processing
    return null;
  }
  
  /**
   * Log a detected attack
   * @param logEntry - WAF log entry
   */
  private async logAttack(logEntry: WafLogEntry): Promise<void> {
    try {
      await this.supabase
        .from(this.logTableName)
        .insert(logEntry);
    } catch (error) {
      console.error("Error logging WAF attack:", error);
    }
  }
  
  /**
   * Sanitize a value for logging (prevent log injection)
   * @param value - Value to sanitize
   * @returns Sanitized value
   */
  private sanitizeValue(value: string): string {
    if (!value) return "";
    
    // Truncate long values
    if (value.length > 200) {
      value = value.substring(0, 200) + "...";
    }
    
    // Replace newlines and tabs
    value = value.replace(/[\r\n\t]/g, " ");
    
    return value;
  }
  
  /**
   * Sanitize headers for logging
   * @param headers - Headers object
   * @returns Sanitized headers
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      "authorization",
      "cookie",
      "set-cookie",
      "x-api-key",
      "api-key",
      "password",
      "token"
    ];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = this.sanitizeValue(value);
      }
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize an object for logging
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    // Remove sensitive fields
    const sensitiveFields = [
      "password",
      "token",
      "api_key",
      "apikey",
      "secret",
      "credential",
      "auth",
      "key",
      "jwt",
      "session"
    ];
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizeValue(value);
        }
      } else if (value !== null && typeof value === "object") {
        sanitized[key] = JSON.stringify(this.sanitizeObject(this.flattenObject(value)));
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }
  
  /**
   * Flatten a nested object into a single-level object
   * @param obj - Object to flatten
   * @param prefix - Key prefix for nested objects
   * @returns Flattened object
   */
  private flattenObject(obj: any, prefix = ""): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    if (!obj || typeof obj !== "object") {
      return flattened;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const arrayValue = value[i];
          if (arrayValue !== null && typeof arrayValue === "object") {
            Object.assign(flattened, this.flattenObject(arrayValue, `${newKey}[${i}]`));
          } else if (typeof arrayValue === "string") {
            flattened[`${newKey}[${i}]`] = arrayValue;
          }
        }
      } else if (typeof value === "string") {
        flattened[newKey] = value;
      } else if (value !== undefined && value !== null) {
        flattened[newKey] = String(value);
      }
    }
    
    return flattened;
  }
  
  /**
   * Get numeric value for protection level for comparison
   * @param level - Protection level
   * @returns Numeric value
   */
  private getProtectionLevelValue(level: WafProtectionLevel): number {
    switch (level) {
      case WafProtectionLevel.LOW:
        return 1;
      case WafProtectionLevel.MEDIUM:
        return 2;
      case WafProtectionLevel.HIGH:
        return 3;
      case WafProtectionLevel.MAXIMUM:
        return 4;
      default:
        return 0;
    }
  }
  
  /**
   * Clean up old WAF logs
   * @param daysToKeep - Number of days to keep logs
   * @returns Number of logs deleted
   */
  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const { data, error } = await this.supabase
        .from(this.logTableName)
        .delete()
        .lt("timestamp", cutoffDate.toISOString())
        .select("count");
      
      if (error) {
        console.error("Error cleaning up old WAF logs:", error);
        return 0;
      }
      
      return data?.length || 0;
    } catch (error) {
      console.error("Error cleaning up old WAF logs:", error);
      return 0;
    }
  }
}

/**
 * Create a WAF instance with environment variables
 * @returns WAF instance
 */
export function createWAF(): WebApplicationFirewall {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  
  return new WebApplicationFirewall(supabaseUrl, supabaseKey);
}

// Export a singleton instance for use across functions
let wafInstance: WebApplicationFirewall | null = null;

/**
 * Get the WAF singleton instance
 * @returns WAF instance
 */
export function getWAF(): WebApplicationFirewall {
  if (!wafInstance) {
    wafInstance = createWAF();
  }
  return wafInstance;
}
