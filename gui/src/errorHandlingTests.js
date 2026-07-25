/**
 * Error Handling Test Suite for PNF-AIMS
 * Tests retry logic, error messages, and recovery mechanisms
 * 
 * Usage:
 * 1. Import this module in your test environment
 * 2. Use ErrorSimulator to inject failures
 * 3. Verify error messages and retry behavior
 */

class ErrorSimulator {
  constructor() {
    this.originalFetch = window.fetch;
    this.simulationMode = null;
    this.requestCount = 0;
    this.failurePattern = [];
  }

  /**
   * Enable error simulation mode
   * @param {string} mode - 'timeout' | 'network' | '401' | '429' | '500' | 'slow' | 'intermittent'
   */
  enable(mode = 'timeout', options = {}) {
    this.simulationMode = mode;
    this.requestCount = 0;
    this.failurePattern = options.failurePattern || [];
    
    window.fetch = this.mockFetch.bind(this);
    console.log(`🧪 Error Simulation Enabled: ${mode}`);
  }

  /**
   * Disable simulation and restore original fetch
   */
  disable() {
    window.fetch = this.originalFetch;
    this.simulationMode = null;
    console.log('✅ Error Simulation Disabled');
  }

  /**
   * Mock fetch implementation that simulates errors
   */
  async mockFetch(url, options) {
    this.requestCount++;
    const urlStr = typeof url === 'string' ? url : url.toString();

    console.log(`📡 Request #${this.requestCount}: ${urlStr.split('/').pop()}`);

    switch (this.simulationMode) {
      case 'timeout':
        return this.simulateTimeout();
      
      case 'network':
        return this.simulateNetworkError();
      
      case '401':
        return this.simulateUnauthorized();
      
      case '429':
        return this.simulateRateLimited();
      
      case '500':
        return this.simulateServerError();
      
      case 'slow':
        return this.simulateSlow(urlStr, options);
      
      case 'intermittent':
        return this.simulateIntermittent(urlStr, options, this.requestCount);
      
      case 'corrupted':
        return this.simulateCorruptedResponse();
      
      default:
        return this.originalFetch(url, options);
    }
  }

  /**
   * Simulate request timeout (AbortError)
   */
  async simulateTimeout() {
    await new Promise(resolve => setTimeout(resolve, 100));
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  }

  /**
   * Simulate network connectivity failure
   */
  async simulateNetworkError() {
    const error = new Error('Failed to fetch');
    error.name = 'TypeError';
    throw error;
  }

  /**
   * Simulate 401 Unauthorized (missing/invalid API key)
   */
  async simulateUnauthorized() {
    return {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: 'Invalid API key',
        message: 'Authorization header is missing or invalid'
      }),
      text: async () => 'Unauthorized'
    };
  }

  /**
   * Simulate 429 Rate Limited
   */
  async simulateRateLimited() {
    return {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: 'Rate limit exceeded',
        retry_after: 60
      }),
      text: async () => 'Too Many Requests'
    };
  }

  /**
   * Simulate 500 Server Error
   */
  async simulateServerError() {
    return {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: 'Provider service failure',
        message: 'The generation service encountered an internal error'
      }),
      text: async () => 'Internal Server Error'
    };
  }

  /**
   * Simulate slow response (test timeout logic)
   */
  async simulateSlow(url, options) {
    // Simulate 5 second delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    return {
      ok: true,
      status: 200,
      json: async () => ({ audioUrl: 'https://example.com/audio.mp3' }),
      text: async () => ''
    };
  }

  /**
   * Simulate intermittent failures (fail first N times, then succeed)
   */
  async simulateIntermittent(url, options, requestNumber) {
    const failCount = 2; // Fail first 2 attempts, succeed on 3rd
    
    if (requestNumber <= failCount) {
      console.log(`  ⚠️ Attempt ${requestNumber}/${failCount + 1}: Simulating failure...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      const error = new Error('Network request failed');
      error.name = 'TypeError';
      throw error;
    }
    
    console.log(`  ✅ Attempt ${requestNumber}/${failCount + 1}: Success after retries!`);
    return {
      ok: true,
      status: 200,
      json: async () => ({ audioUrl: 'https://example.com/audio.mp3' }),
      text: async () => ''
    };
  }

  /**
   * Simulate corrupted/malformed JSON response
   */
  async simulateCorruptedResponse() {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
      text: async () => '<html>500 Internal Server Error</html>'
    };
  }

  /**
   * Get simulation statistics
   */
  getStats() {
    return {
      simulationMode: this.simulationMode,
      requestsAttempted: this.requestCount
    };
  }
}

// Global error simulation utility
window.ErrorSimulator = new ErrorSimulator();

/**
 * TEST SCENARIOS
 * Run these in the browser console to test error handling
 */

const TEST_SCENARIOS = {
  /**
   * Test 1: Timeout handling
   * Expected: Shows "Request timeout" message, retries 3 times with backoff
   */
  testTimeout: () => {
    console.log('🧪 TEST 1: Timeout Handling');
    window.ErrorSimulator.enable('timeout');
    console.log('Trigger generation and observe retry behavior');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 2: Network failure with automatic retry
   * Expected: Shows error on first 2 attempts, succeeds on 3rd
   */
  testIntermittentFailure: () => {
    console.log('🧪 TEST 2: Intermittent Failure with Retry');
    window.ErrorSimulator.enable('intermittent');
    console.log('Trigger generation. Should retry and eventually succeed.');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 3: 401 Unauthorized (invalid API key)
   * Expected: Shows "Check API keys" message, no retry (fail fast on 4xx)
   */
  testUnauthorized: () => {
    console.log('🧪 TEST 3: 401 Unauthorized');
    window.ErrorSimulator.enable('401');
    console.log('Trigger generation. Should fail with API key error message.');
    console.log('Expected: No automatic retry on 401');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 4: 429 Rate Limit
   * Expected: Shows "Rate limited" message, suggests retry later
   */
  testRateLimited: () => {
    console.log('🧪 TEST 4: 429 Rate Limited');
    window.ErrorSimulator.enable('429');
    console.log('Trigger generation. Should show rate limit message.');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 5: 500 Server Error
   * Expected: Shows "Provider error" message, may retry
   */
  testServerError: () => {
    console.log('🧪 TEST 5: 500 Server Error');
    window.ErrorSimulator.enable('500');
    console.log('Trigger generation. Should retry with backoff.');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 6: Slow response (test timeout)
   * Expected: Request times out after 30s, shows timeout message
   */
  testSlowResponse: () => {
    console.log('🧪 TEST 6: Slow Response');
    window.ErrorSimulator.enable('slow');
    console.log('Trigger generation. Request should timeout after 30 seconds.');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 7: Corrupted response
   * Expected: Shows "Generation failed" message, handles gracefully
   */
  testCorruptedResponse: () => {
    console.log('🧪 TEST 7: Corrupted Response');
    window.ErrorSimulator.enable('corrupted');
    console.log('Trigger generation. Should handle JSON parse error.');
    console.log('Cleanup: window.ErrorSimulator.disable()');
  },

  /**
   * Test 8: localStorage quota exceeded
   * Expected: Shows "Storage quota exceeded" message
   */
  testStorageQuotaExceeded: () => {
    console.log('🧪 TEST 8: localStorage Quota Exceeded');
    console.log('This test requires manually filling localStorage:');
    console.log('1. Open browser DevTools → Application → Storage');
    console.log('2. Save many sessions until quota is exceeded');
    console.log('3. Try to save another session');
    console.log('4. Should show "Storage quota exceeded" message');
  },

  /**
   * Test 9: Private browsing mode (no localStorage)
   * Expected: Shows "localStorage not available" message
   */
  testPrivateBrowsing: () => {
    console.log('🧪 TEST 9: Private Browsing Mode');
    console.log('This test requires opening the app in private/incognito mode:');
    console.log('1. Open app in private window');
    console.log('2. Try to save a session');
    console.log('3. Should show "localStorage not available" message');
  }
};

// Export for testing
window.TEST_SCENARIOS = TEST_SCENARIOS;

console.log(`
╔════════════════════════════════════════════════════════════╗
║  🧪 PNF-AIMS ERROR HANDLING TEST SUITE LOADED              ║
╠════════════════════════════════════════════════════════════╣
║  Available test scenarios:                                  ║
║  • window.TEST_SCENARIOS.testTimeout()                     ║
║  • window.TEST_SCENARIOS.testIntermittentFailure()         ║
║  • window.TEST_SCENARIOS.testUnauthorized()                ║
║  • window.TEST_SCENARIOS.testRateLimited()                 ║
║  • window.TEST_SCENARIOS.testServerError()                 ║
║  • window.TEST_SCENARIOS.testSlowResponse()                ║
║  • window.TEST_SCENARIOS.testCorruptedResponse()           ║
║  • window.TEST_SCENARIOS.testStorageQuotaExceeded()        ║
║  • window.TEST_SCENARIOS.testPrivateBrowsing()             ║
║                                                             ║
║  Disable simulation:                                        ║
║  • window.ErrorSimulator.disable()                         ║
║                                                             ║
║  Get stats:                                                ║
║  • window.ErrorSimulator.getStats()                        ║
╚════════════════════════════════════════════════════════════╝
`);
