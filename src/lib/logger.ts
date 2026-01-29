// Development-aware logging utility
// src/lib/logger.ts

/**
 * Logger utility that respects NODE_ENV to prevent verbose logging in production
 * 
 * Usage:
 * - logger.dev(): Development-only logs (suppressed in production)
 * - logger.warn(): Warnings (always logged)
 * - logger.error(): Errors (always logged)
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Development-only logging
   * Suppressed in production to keep logs clean
   */
  dev: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Warning messages - always logged
   * Use for non-critical issues that should be investigated
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error messages - always logged
   * Use for errors that need immediate attention
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info messages - always logged but less verbose
   * Use for important production events
   */
  info: (...args: any[]) => {
    console.log(...args);
  },
};
