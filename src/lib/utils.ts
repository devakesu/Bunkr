// Utility functions
// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";
import { logger } from "./logger";

/**
 * Combines and merges Tailwind CSS classes with proper precedence handling.
 * Uses clsx for conditional class handling and tailwind-merge to resolve conflicts.
 * 
 * @param inputs - Class values to merge (strings, arrays, objects, etc.)
 * @returns Merged class string with resolved Tailwind conflicts
 * @example
 * ```ts
 * cn('px-2 py-1', 'px-4') // Returns 'py-1 px-4' (px-4 overrides px-2)
 * cn('text-red-500', { 'text-blue-500': isActive }) // Conditionally applies classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Lazy initialization of SENTRY_HASH_SALT to avoid validation during Next.js build.
 * The secret is retrieved on first use (at runtime) rather than module load time.
 * 
 * LAZY EVALUATION RATIONALE:
 * - Next.js build evaluates server code at compile time
 * - Module-level validation would fail during build (SENTRY_HASH_SALT unavailable)
 * - Lazy getter defers validation until actual runtime usage
 * - Caches result after first access for performance
 * 
 * IMPORTANT: This module is also used in client bundles. In the browser,
 * non-NEXT_PUBLIC env vars like SENTRY_HASH_SALT are not available and
 * process.env.NODE_ENV is inlined as "production". To avoid breaking the
 * client runtime, we must not throw during module evaluation in the browser.
 */
let SECRET: string | null = null;
let secretWarningShown = false;

function getSecret(): string {
  // Return cached value if already initialized
  if (SECRET !== null) {
    return SECRET;
  }

  const isBrowser = typeof window !== "undefined";

  if (process.env.SENTRY_HASH_SALT) {
    SECRET = process.env.SENTRY_HASH_SALT;
    return SECRET;
  }

  // Additional safety check: explicitly verify we're not in production before using fallback
  // This prevents silent fallback usage if NODE_ENV is misconfigured
  if (process.env.NODE_ENV === "production" && !isBrowser) {
    throw new Error("SENTRY_HASH_SALT is required in production");
  }

  // In development (server) or any browser bundle, fall back to a fixed
  // non-secret salt so we do not crash the client runtime.
  if (process.env.NODE_ENV === "development" || isBrowser) {
    // Log warning in development server context (not browser) about using fallback salt
    // This helps developers understand that production logs will be different
    if (!isBrowser && process.env.NODE_ENV === "development" && !secretWarningShown) {
      logger.warn(
        "[SECURITY WARNING] Using fallback salt for redaction. " +
        "Set SENTRY_HASH_SALT environment variable for production-like hashing. " +
        "Development logs with this salt will produce different hashes than production logs."
      );
      secretWarningShown = true;
    }
    SECRET = "dev-salt-only";
    return SECRET;
  }

  // Final safety net: if we reach here, we're in an unexpected environment
  throw new Error("SENTRY_HASH_SALT is required in production");
}

/**
 * Redacts sensitive data (email, ID) for safe logging using deterministic hashing.
 * 
 * INTENTIONAL DESIGN: DETERMINISTIC HASHING
 * This function uses HMAC-SHA256 to create a deterministic hash, which means:
 * - The same input always produces the same hash
 * - Useful for correlating issues for the same user across logs
 * - Enables debugging patterns like "user X had this issue 5 times"
 * 
 * SECURITY CONSIDERATIONS:
 * - An attacker with log access and one known value could correlate other occurrences
 * - The 12-character truncation reduces collision resistance but is acceptable for logging:
 *   * 16^12 = ~281 trillion possible hashes
 *   * Collision probability is negligible for user bases under 1 million users
 *   * Birthday paradox: ~50% collision chance at ~16 million unique values
 * - This is acceptable for logging/debugging but NOT for security-critical operations
 * - SALT ROTATION: If SENTRY_HASH_SALT is compromised and an attacker gains log access,
 *   they could build rainbow tables to reverse-engineer user identifiers. Consider:
 *   * Rotating the salt periodically (e.g., quarterly) as a security best practice
 *   * Implementing salt versioning (e.g., SENTRY_HASH_SALT_V2) so old logs remain valid
 *   * Treating the salt with the same security as database credentials
 * 
 * ALTERNATIVE APPROACHES (if needed):
 * - For maximum privacy: Use a random salt per session (cannot correlate across sessions)
 * - For non-deterministic: Add timestamp to hash (each call produces different output)
 * 
 * The current implementation prioritizes debugging utility over perfect privacy,
 * which is an acceptable trade-off for logged data that should already be access-controlled.
 * 
 * @param type - Type of data being redacted ('email' or 'id')
 * @param value - The sensitive value to redact
 * @returns A 12-character deterministic hash for safe logging
 */
export const redact = (type: "email" | "id", value: string) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(`${type}:${value}`)
    .digest("hex")
    .slice(0, 12);

/**
 * Converts a number to Roman numeral representation (1-12).
 * Numbers outside this range are returned as-is.
 * 
 * @param num - Number or string to convert (1-12)
 * @returns Roman numeral string (I-XII) or original value if out of range
 * @example
 * ```ts
 * toRoman(1) // Returns "I"
 * toRoman(3) // Returns "III"
 * toRoman(12) // Returns "XII"
 * toRoman(15) // Returns "15" (out of range)
 * ```
 */
export const toRoman = (num: number | string): string => {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n) || n < 1) return String(num);
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[n - 1] || String(n);
};

/**
 * Normalizes session identifiers to a standard format.
 * Converts various session inputs ("Session 1", "2nd Hour", "iii", "Lab")
 * into a standardized string number ("1", "2", "3") or upper case string ("LAB").
 * 
 * @param session - Session identifier in various formats
 * @returns Normalized session string (numeric or uppercase)
 * @example
 * ```ts
 * normalizeSession("Session 1") // Returns "1"
 * normalizeSession("iii") // Returns "3"
 * normalizeSession("2nd Hour") // Returns "2"
 * normalizeSession("Lab") // Returns "LAB"
 * ```
 */
export const normalizeSession = (session: string | number): string => {
  let s = String(session).toLowerCase().trim();
  
  // 1. Remove common noise
  s = s.replace(/session|lecture|lec|lab|hour|hr|period/g, '').trim();
  s = s.replace(/(st|nd|rd|th)$/, '').trim(); // Remove ordinals

  // 2. Roman to Number Map
  const romans: Record<string, string> = {
      'viii': '8', 'vii': '7', 'vi': '6', 'v': '5',
      'iv': '4', 'iii': '3', 'ii': '2', 'i': '1',
      'ix': '9', 'x': '10'
  };

  if (romans[s]) return romans[s];

  // 3. Parse Integer
  const num = parseInt(s, 10);
  if (!isNaN(num)) return num.toString();

  // 4. Fallback (e.g. "A", "B", "Extra")
  return s.toUpperCase();
};

/**
 * Normalizes a date string to ISO date format (YYYY-MM-DD).
 * Handles ISO datetime strings (with T), DD/MM/YYYY, and already-normalized YYYY-MM-DD strings.
 *
 * @param str - Date string in any of the supported formats
 * @returns Date string in YYYY-MM-DD format
 * @example
 * ```ts
 * normalizeToISODate("2024-01-15T10:30:00Z") // Returns "2024-01-15"
 * normalizeToISODate("15/01/2024")            // Returns "2024-01-15"
 * normalizeToISODate("2024-01-15")            // Returns "2024-01-15"
 * ```
 */
export function normalizeToISODate(str: string): string {
  if (!str) return '';
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
}

/**
 * Standardizes date to YYYYMMDD format.
 * Handles Date objects, ISO strings, and "DD-MM-YYYY" formats.
 * 
 * @param date - Date in various formats (Date object, ISO string, DD-MM-YYYY)
 * @returns Date string in YYYYMMDD format
 * @example
 * ```ts
 * normalizeDate(new Date(2024, 0, 15)) // Returns "20240115"
 * normalizeDate("2024-01-15T10:30:00Z") // Returns "20240115"
 * normalizeDate("15-01-2024") // Returns "20240115"
 * ```
 */
export const normalizeDate = (date: string | Date): string => {
  if (!date) return "";
  
  if (date instanceof Date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}${m}${d}`;
  }

  const dateStr = String(date).trim();
  
  // Handle ISO "2023-01-01T..."
  if (dateStr.includes("T")) {
      return dateStr.split("T")[0].replace(/-/g, "");
  }
  
  // Handle "YYYY-MM-DD" or "DD-MM-YYYY"
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    // If first part is year (4 digits)
    if (parts[0].length === 4) return parts.join(""); 
    // Assume DD-MM-YYYY -> YYYYMMDD
    return `${parts[2]}${parts[1]}${parts[0]}`;
  }
  
  return dateStr.replace(/[^0-9]/g, "");
};

/**
 * Generates a canonical key for attendance slot identification and deduplication.
 * Format: {COURSEID}_{YYYYMMDD}_{SESSION_ROMAN_OR_UPPER}
 * 
 * @param courseId - Course identifier
 * @param date - Date of the session
 * @param session - Session identifier
 * @returns Canonical slot key string
 * @example
 * ```ts
 * generateSlotKey(101, "2024-01-15", 1) // Returns "101_20240115_I"
 * generateSlotKey("CS101", new Date(2024, 0, 15), "iii") // Returns "CS101_20240115_III"
 * ```
 */
export const generateSlotKey = (courseId: string | number, date: string | Date, session: string | number) => {
  const cId = String(courseId).trim();
  const d = normalizeDate(date);
  
  // Logic: Normalized Number -> Roman (matches DB/Legacy logic)
  const normSession = normalizeSession(session);
  const n = parseInt(normSession, 10);
  const finalSession = !isNaN(n) ? toRoman(n) : normSession;

  return `${cId}_${d}_${finalSession}`;
};

/**
 * Formats session name for user-friendly display.
 * Converts session identifiers to ordinal format (1st Hour, 2nd Hour, etc.).
 * 
 * @param sessionName - Raw session identifier
 * @returns Formatted session name for display
 * @example
 * ```ts
 * formatSessionName("i") // Returns "1st Hour"
 * formatSessionName("2") // Returns "2nd Hour"
 * formatSessionName("iii") // Returns "3rd Hour"
 * ```
 */
export function formatSessionName(sessionName: string): string {
  if (!sessionName) return "";
  const clean = sessionName.toString().replace(/Session|Hour/gi, "").trim();
  
  // Handle Roman numerals (case-insensitive)
  const lower = clean.toLowerCase();
  const romanMap: Record<string, string> = {
    "i": "1st Hour", "ii": "2nd Hour", "iii": "3rd Hour", "iv": "4th Hour",
    "v": "5th Hour", "vi": "6th Hour", "vii": "7th Hour", "viii": "8th Hour"
  };
  if (romanMap[lower]) return romanMap[lower];

  // Handle numbers
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st Hour`;
    if (j === 2 && k !== 12) return `${num}nd Hour`;
    if (j === 3 && k !== 13) return `${num}rd Hour`;
    return `${num}th Hour`;
  }

  // Fallback
  return sessionName.toLowerCase().includes("session") ? sessionName : `Session ${sessionName}`;
}

/**
 * Extracts numeric value from session name for sorting.
 * Converts Roman numerals and text to sortable numbers.
 * 
 * @param name - Session name in any format
 * @returns Numeric value for sorting (999 if unable to parse)
 * @example
 * ```ts
 * getSessionNumber("1st Hour") // Returns 1
 * getSessionNumber("iii") // Returns 3
 * getSessionNumber("Session 5") // Returns 5
 * getSessionNumber("Lab") // Returns 999 (fallback)
 * ```
 */
export function getSessionNumber(name: string): number {
  if (!name) return 999;
  const clean = name.toString().toLowerCase().replace(/session|hour/g, "").replace(/hour/g, "").trim();
  
  const romanMap: Record<string, number> = { 
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8 
  };
  if (romanMap[clean]) return romanMap[clean];
  
  const match = clean.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

/**
 * Formats course code by removing whitespace and extracting main code.
 * Handles hyphenated codes by taking the prefix.
 * 
 * @param code - Raw course code
 * @returns Formatted course code without whitespace
 * @example
 * ```ts
 * formatCourseCode("CS 101-A") // Returns "CS101"
 * formatCourseCode("MATH 201") // Returns "MATH201"
 * ```
 */
export const formatCourseCode = (code: string): string => {
  if (code.includes("-")) {
    const subcode = code.split("-")[0].trim();
    return subcode.replace(/[\s\u00A0]/g, "");
  }

  return code.replace(/[\s\u00A0]/g, "");
};

// Track if we've already logged the development IP warning to avoid spam
// This flag persists across hot module reloads and will only log once per server restart
let hasLoggedDevIpWarning = false;

/**
 * Extracts the client IP address from request headers.
 * 
 * DEPLOYMENT ARCHITECTURE ASSUMPTIONS:
 * This function prioritizes headers in the following order, which assumes a specific deployment setup:
 * 1. cf-connecting-ip (Cloudflare CDN) - Most trusted when behind Cloudflare
 * 2. x-real-ip (nginx/Apache reverse proxy) - Common for traditional reverse proxies
 * 3. x-forwarded-for (various proxies/load balancers) - Takes first IP in chain
 * 
 * CONFIGURATION NOTES:
 * - If NOT behind Cloudflare: Consider prioritizing x-real-ip or x-forwarded-for
 * - Behind AWS ALB/ELB: x-forwarded-for is the standard header
 * - Behind Google Cloud Load Balancer: x-forwarded-for is used
 * - Behind Azure Front Door: x-azure-clientip or x-forwarded-for
 * 
 * The current order assumes Cloudflare as the primary CDN. If your deployment differs,
 * adjust the priority order or make it configurable via environment variables.
 * 
 * SECURITY WARNING:
 * These headers can be spoofed if not properly configured at the reverse proxy level.
 * Ensure your reverse proxy strips/overwrites these headers from client requests.
 * 
 * DEVELOPMENT TESTING:
 * In development mode, set TEST_CLIENT_IP environment variable to test IP-based logic
 * with a specific IP address (e.g., TEST_CLIENT_IP=203.0.113.45).
 * 
 * @param headerList - The Headers object from the request
 * @returns The client IP address or null if it cannot be determined
 */
export function getClientIp(headerList: Headers): string | null {
  const cf = headerList.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headerList.get("x-forwarded-for");
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;

  // In development, allow testing with a specific IP via environment variable
  if (process.env.NODE_ENV === "development") {
    const testIp = process.env.TEST_CLIENT_IP;
    
    // Log warning once per server start to make it prominent but avoid spam
    if (!hasLoggedDevIpWarning) {
      hasLoggedDevIpWarning = true;
      logger.warn(
        "\n" +
        "═══════════════════════════════════════════════════════════════════════\n" +
        "⚠️  DEVELOPMENT MODE: Client IP Detection\n" +
        "═══════════════════════════════════════════════════════════════════════\n" +
        "No IP forwarding headers found. This affects IP-based security features\n" +
        "such as rate limiting, geolocation, and audit logging.\n\n" +
        "To test real IP logic in development:\n" +
        "  1. Set TEST_CLIENT_IP environment variable (e.g., TEST_CLIENT_IP=203.0.113.45)\n" +
        "  2. Or send x-real-ip or cf-connecting-ip headers in your requests\n" +
        `\nCurrent fallback: ${testIp || "127.0.0.1"}\n` +
        "═══════════════════════════════════════════════════════════════════════\n"
      );
    }
    
    return testIp || "127.0.0.1";
  }

  // In production, return null to signal that IP extraction failed
  // Callers must handle this null case appropriately (e.g., by rejecting the request)
  logger.warn(
    "[getClientIp] No IP forwarding headers found in production. " +
    "Ensure reverse proxy is configured to set x-forwarded-for, x-real-ip, or cf-connecting-ip headers. " +
    "Request will be rejected if IP is required for security checks."
  );
  return null;
}

/**
 * Compresses an image file to JPEG format with quality control.
 * Automatically resizes images larger than 1920px width while maintaining aspect ratio.
 * Adds white background to handle transparent PNGs.
 * 
 * @param file - Image file to compress
 * @param quality - JPEG quality (0-1), defaults to 0.7
 * @returns Promise resolving to compressed JPEG file
 * @throws {Error} If canvas context cannot be created or compression fails
 * @example
 * ```ts
 * const compressed = await compressImage(imageFile, 0.8)
 * // Returns JPEG with 80% quality, max width 1920px
 * ```
 */
export const compressImage = (file: File, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        
        // Scale down if image is massive
        const maxWidth = 1920; 
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Fill background with white before drawing
        // This prevents transparent PNGs from turning black when converted to JPEG
        ctx.fillStyle = "#FFFFFF"; 
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with specified quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty"));
              return;
            }

            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            
            const compressedFile = new File([blob], newName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Constants for hostname validation
const LOCALHOST_VARIANTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
// IPv6 pattern: matches standard IPv6 format or bracket-enclosed format
// window.location.hostname never includes ports, so we don't need to worry about port separators
// Note: The bracket pattern is intentionally permissive for localhost detection purposes only.
// It matches [::1] and other bracket-enclosed formats without full RFC 4291 validation.
const IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^\[.*\]$/;

/**
 * Gets the application domain for email addresses, extracting from environment
 * variable or window.location.hostname with validation to filter out localhost/IP addresses.
 * 
 * This utility provides consistent hostname detection logic across error components.
 * 
 * FALLBACK BEHAVIOR:
 * 1. Uses NEXT_PUBLIC_APP_DOMAIN environment variable if set (RECOMMENDED)
 * 2. Uses NEXT_PUBLIC_DEFAULT_DOMAIN environment variable if set
 * 3. In development only: Falls back to window.location.hostname if available and not localhost/IP
 * 4. Uses the provided fallbackDomain parameter (default: 'ghostclass.app')
 * 
 * SECURITY WARNING:
 * In production, this function requires NEXT_PUBLIC_APP_DOMAIN or NEXT_PUBLIC_DEFAULT_DOMAIN
 * to be explicitly configured. Using window.location.hostname in production could allow
 * attackers to control the email destination via hostname manipulation (e.g., through
 * open redirects or malicious proxies), potentially exposing error details.
 * 
 * The function will log a warning in production if environment variables are not set
 * and will refuse to use window.location.hostname as a fallback for security.
 * 
 * @param fallbackDomain - The fallback domain to use if no valid domain can be determined (default: 'ghostclass.app')
 * @returns The application domain suitable for use in email addresses
 * 
 * @example
 * ```ts
 * const domain = getAppDomain(); // Returns domain from env or fallback
 * const email = `admin@${domain}`;
 * ```
 */
export function getAppDomain(fallbackDomain: string = 'ghostclass.app'): string {
  const isProduction = process.env.NODE_ENV === "production";
  let appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  
  // Only use window.location.hostname in development for convenience
  // In production, this is a security risk and should never be used
  if (!appDomain && typeof window !== "undefined" && !isProduction) {
    const hostname = window.location.hostname;
    
    // Check if hostname is a local development environment or IP address
    const isLocalhost = LOCALHOST_VARIANTS.has(hostname);
    const isIPv4 = IPV4_PATTERN.test(hostname);
    const isIPv6 = IPV6_PATTERN.test(hostname);
    
    if (hostname && !isLocalhost && !isIPv4 && !isIPv6) {
      appDomain = hostname;
    }
  }
  
  // Use environment variable for default domain if set, otherwise use parameter
  const defaultDomain = process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || fallbackDomain;
  
  // Security check: warn if using fallback in production
  if (isProduction && !process.env.NEXT_PUBLIC_APP_DOMAIN && !process.env.NEXT_PUBLIC_DEFAULT_DOMAIN) {
    logger.warn(
      '[SECURITY] getAppDomain: NEXT_PUBLIC_APP_DOMAIN and NEXT_PUBLIC_DEFAULT_DOMAIN are not set in production. ' +
      `Using hardcoded fallback domain '${defaultDomain}'. This could be a security risk for error reporting. ` +
      'Please configure these environment variables.'
    );
  }
  
  // Final fallback
  return appDomain ?? defaultDomain;
}
