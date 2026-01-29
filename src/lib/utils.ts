// Utility functions
// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HASH_SECRET = process.env.SENTRY_HASH_SALT;
const getSecret = () => {
  if (HASH_SECRET) return HASH_SECRET;
  if (process.env.NODE_ENV === "development") return "dev-salt-only";
  throw new Error("SENTRY_HASH_SALT is required in production");
};

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

export const toRoman = (num: number | string): string => {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n) || n < 1) return String(num);
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[n - 1] || String(n);
};

/**
 * Converts various session inputs ("Session 1", "2nd Hour", "iii", "Lab")
 * into a standardized string number ("1", "2", "3") or upper case string ("LAB").
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
 * Standardizes date to YYYYMMDD format.
 * Handles Date objects, ISO strings, and "DD-MM-YYYY".
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
 * Generates the canonical key for maps and deduplication.
 * Format: {COURSEID}_{YYYYMMDD}_{SESSION_ROMAN_OR_UPPER}
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

// Format for Display (1st Hour, 2nd Hour)
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

// Get Sortable Number (1, 2, 3)
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

export const formatCourseCode = (code: string): string => {
  if (code.includes("-")) {
    const subcode = code.split("-")[0].trim();
    return subcode.replace(/[\s\u00A0]/g, "");
  }

  return code.replace(/[\s\u00A0]/g, "");
};

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

  // In development, log a warning and return null instead of fallback
  // This helps identify issues with IP extraction during development
  if (process.env.NODE_ENV === "development") {
    console.warn("[getClientIp] No IP headers found in development mode. Rate limiting and logging may be affected.");
    return null;
  }

  return null;
}

// Helper function to compress image
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