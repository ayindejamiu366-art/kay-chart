/**
 * Circuit Breaker
 * Prevents wasting time on providers that are down.
 * After `failureThreshold` consecutive failures, skips the provider for `resetTimeoutMs`.
 */

class CircuitBreaker {
  constructor(name, failureThreshold = 3, resetTimeoutMs = 300000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed = normal, open = skipping, half-open = testing
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`[CircuitBreaker] ${this.name} circuit OPEN — skipping for ${this.resetTimeoutMs / 1000}s`);
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = null;
  }

  canExecute() {
    if (this.state === 'closed') return true;
    if (this.state === 'open' && this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
      this.state = 'half-open';
      return true;
    }
    return this.state === 'half-open';
  }
}

module.exports = CircuitBreaker;
