/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects the application from cascading failures when the EzyGo API is down
 * or experiencing issues. Uses three states:
 * 
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: API is failing, reject requests immediately (fail fast)
 * - HALF_OPEN: Testing if API has recovered
 * 
 * Configuration:
 * - Opens after 3 consecutive failures
 * - Stays open for 60 seconds before attempting recovery
 * - Tests with 2 requests before closing
 */

import { logger } from './logger';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Custom error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Error that should not trigger circuit breaker (e.g., 4xx client errors)
 */
export class NonBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonBreakerError';
  }
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailTime = 0;
  private successCount = 0;
  private halfOpenInFlight = 0;
  
  // Conservative thresholds for single-IP deployment
  // Opens circuit after just 3 failures to protect against extended outages
  private readonly failureThreshold = 3; // Lower threshold for faster protection
  private readonly resetTimeout = 60000; // 60 seconds - longer wait for recovery
  private readonly halfOpenMaxRequests = 2; // Test with fewer requests
  
  /**
   * Execute a function with circuit breaker protection
   * 
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      const now = Date.now();
      const timeSinceFailure = now - this.lastFailTime;
      
      // Try to close after timeout
      if (timeSinceFailure > this.resetTimeout) {
        logger.dev('[Circuit Breaker] Transitioning to HALF_OPEN', {
          context: 'circuit-breaker',
          timeSinceFailure,
        });
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        this.halfOpenInFlight = 0;
      } else {
        const timeRemaining = Math.ceil((this.resetTimeout - timeSinceFailure) / 1000);
        logger.warn('[Circuit Breaker] Circuit is OPEN - failing fast', {
          context: 'circuit-breaker',
          failures: this.failures,
          timeRemaining: `${timeRemaining}s`,
        });
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open - EzyGo API may be experiencing issues. Retry in ${timeRemaining}s.`
        );
      }
    }
    
    // In HALF_OPEN state, only allow limited concurrent requests through
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenInFlight >= this.halfOpenMaxRequests) {
        logger.warn('[Circuit Breaker] HALF_OPEN request limit reached - rejecting request', {
          context: 'circuit-breaker',
          halfOpenInFlight: this.halfOpenInFlight,
          maxRequests: this.halfOpenMaxRequests,
        });
        throw new CircuitBreakerOpenError(
          'Circuit breaker is testing recovery - please try again shortly.'
        );
      }
      this.halfOpenInFlight++;
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      // Don't count NonBreakerError (4xx) as breaker failures
      if (error instanceof NonBreakerError) {
        throw error;
      }
      this.onFailure(error);
      throw error;
    } finally {
      // Release HALF_OPEN slot if we were using one
      if (this.state === 'HALF_OPEN' || 
          (this.state === 'CLOSED' && this.halfOpenInFlight > 0)) {
        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      }
    }
  }
  
  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      logger.dev(`[Circuit Breaker] Success in HALF_OPEN (${this.successCount}/${this.halfOpenMaxRequests})`, {
        context: 'circuit-breaker',
      });
      
      // After successful requests in half-open, close the circuit
      if (this.successCount >= this.halfOpenMaxRequests) {
        logger.dev('[Circuit Breaker] Transitioning to CLOSED - API recovered', {
          context: 'circuit-breaker',
        });
        this.state = 'CLOSED';
        this.failures = 0;
        this.successCount = 0;
        this.halfOpenInFlight = 0;
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      if (this.failures > 0) {
        logger.dev('[Circuit Breaker] Resetting failure count', {
          context: 'circuit-breaker',
          previousFailures: this.failures,
        });
        this.failures = 0;
      }
    }
  }
  
  /**
   * Handle failed request
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (this.state === 'HALF_OPEN') {
      logger.warn('[Circuit Breaker] Failure in HALF_OPEN - reopening circuit', {
        context: 'circuit-breaker',
        error: errorMessage,
      });
      this.state = 'OPEN';
      this.successCount = 0;
      this.halfOpenInFlight = 0;
    } else if (this.failures >= this.failureThreshold) {
      logger.error('[Circuit Breaker] Threshold reached - opening circuit', {
        context: 'circuit-breaker',
        failures: this.failures,
        threshold: this.failureThreshold,
        error: errorMessage,
      });
      this.state = 'OPEN';
      this.halfOpenInFlight = 0;
    } else {
      logger.warn('[Circuit Breaker] Request failed', {
        context: 'circuit-breaker',
        failures: this.failures,
        threshold: this.failureThreshold,
        error: errorMessage,
      });
    }
  }
  
  /**
   * Get current circuit breaker status (for monitoring)
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
      successCount: this.successCount,
      isOpen: this.state === 'OPEN',
    };
  }
  
  /**
   * Manually reset the circuit breaker (for testing/admin purposes)
   */
  reset(): void {
    logger.dev('[Circuit Breaker] Manual reset', {
      context: 'circuit-breaker',
    });
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailTime = 0;
    this.successCount = 0;
    this.halfOpenInFlight = 0;
  }
}

// Export singleton instance
export const ezygoCircuitBreaker = new CircuitBreaker();
