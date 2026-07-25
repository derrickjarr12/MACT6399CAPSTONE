/**
 * Performance Profiling Suite for PNF-AIMS
 * Measures bundle size, FFT performance, memory usage, and Web Audio latency
 * 
 * Usage:
 * 1. Load this module (auto-loaded in dev)
 * 2. Call window.PerformanceProfiler methods to measure metrics
 * 3. Export results for analysis
 */

class PerformanceProfiler {
  constructor() {
    this.measurements = {};
    this.marks = {};
  }

  /**
   * Measure memory usage
   * @returns {object} Memory stats (heap used, external, limit)
   */
  measureMemory() {
    if (performance.memory) {
      return {
        heapUsedMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        heapLimitMB: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2),
        heapPercentUsed: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1),
        externalMB: (performance.memory.externalMemoryUsage / 1048576).toFixed(2),
        timestamp: new Date().toISOString()
      };
    }
    return { error: "Memory API not available (Chrome/Edge required with --enable-precise-memory-info)" };
  }

  /**
   * Measure Web Audio context performance
   * @returns {object} Audio context latency and buffer stats
   */
  measureWebAudioLatency() {
    if (typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined') {
      return { error: "Web Audio API not available" };
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    
    const stats = {
      sampleRate: ctx.sampleRate,
      currentTime: ctx.currentTime,
      state: ctx.state,
      maxChannelCount: ctx.maxChannelCount,
      baseLatency: ctx.baseLatency || "N/A",
      outputLatency: ctx.outputLatency || "N/A",
      timestamp: new Date().toISOString()
    };
    
    ctx.close();
    return stats;
  }

  /**
   * Measure FFT analysis performance
   * @param {number} analyserSize - FFT size (256, 512, 1024, 2048, 4096, 8192, 16384, 32768)
   * @returns {object} FFT performance metrics
   */
  measureFFTPerformance(analyserSize = 256) {
    if (typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined') {
      return { error: "Web Audio API not available" };
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = analyserSize;

    // Create test data
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Measure FFT computation time
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      analyser.getByteFrequencyData(dataArray);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;

    const stats = {
      fftSize: analyserSize,
      frequencyBinCount: analyser.frequencyBinCount,
      iterations: iterations,
      totalTimeMs: totalTime.toFixed(2),
      averageTimePerCallMs: avgTime.toFixed(3),
      callsPerSecond: (1000 / avgTime).toFixed(0),
      timestamp: new Date().toISOString()
    };

    ctx.close();
    return stats;
  }

  /**
   * Measure DOM rendering performance
   * @returns {object} Rendering metrics
   */
  measureDOMPerformance() {
    const stats = {
      navigationStart: performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
      firstPaint: performance.timing.responseEnd - performance.timing.navigationStart,
      resourceCount: performance.getEntriesByType('resource').length,
      resourcesData: this.getResourceSizeBreakdown(),
      timestamp: new Date().toISOString()
    };

    return stats;
  }

  /**
   * Get breakdown of resource sizes
   * @returns {object} Size by resource type
   */
  getResourceSizeBreakdown() {
    const resources = performance.getEntriesByType('resource');
    const breakdown = {
      javascript: { count: 0, totalKB: 0 },
      stylesheet: { count: 0, totalKB: 0 },
      image: { count: 0, totalKB: 0 },
      font: { count: 0, totalKB: 0 },
      other: { count: 0, totalKB: 0 }
    };

    resources.forEach(resource => {
      const sizeKB = (resource.transferSize || 0) / 1024;
      
      if (resource.name.endsWith('.js')) {
        breakdown.javascript.count++;
        breakdown.javascript.totalKB += sizeKB;
      } else if (resource.name.endsWith('.css')) {
        breakdown.stylesheet.count++;
        breakdown.stylesheet.totalKB += sizeKB;
      } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(resource.name)) {
        breakdown.image.count++;
        breakdown.image.totalKB += sizeKB;
      } else if (/\.(woff|woff2|ttf|eot)$/i.test(resource.name)) {
        breakdown.font.count++;
        breakdown.font.totalKB += sizeKB;
      } else {
        breakdown.other.count++;
        breakdown.other.totalKB += sizeKB;
      }
    });

    // Round KB values
    Object.keys(breakdown).forEach(key => {
      breakdown[key].totalKB = breakdown[key].totalKB.toFixed(2);
    });

    return breakdown;
  }

  /**
   * Measure main thread blocking
   * @param {number} duration - How long to monitor in ms (default 5000)
   * @returns {object} Long task metrics
   */
  measureMainThreadBlocking(duration = 5000) {
    if (typeof PerformanceObserver === 'undefined') {
      return { error: "PerformanceObserver not available" };
    }

    const longTasks = [];
    
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({
            duration: entry.duration.toFixed(2),
            name: entry.name,
            startTime: entry.startTime.toFixed(2)
          });
        }
      });

      observer.observe({ entryTypes: ['longtask'] });

      // Observe for specified duration
      setTimeout(() => observer.disconnect(), duration);

      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            monitoredDurationMs: duration,
            longTaskCount: longTasks.length,
            longTasks: longTasks,
            timestamp: new Date().toISOString()
          });
        }, duration);
      });
    } catch (e) {
      return { error: "Long task monitoring not available (requires special header)" };
    }
  }

  /**
   * Run full performance audit
   * @returns {object} Complete performance metrics
   */
  async runFullAudit() {
    console.log('🔍 Running comprehensive performance audit...');
    
    const audit = {
      memory: this.measureMemory(),
      webAudio: this.measureWebAudioLatency(),
      fft256: this.measureFFTPerformance(256),
      fft512: this.measureFFTPerformance(512),
      fft1024: this.measureFFTPerformance(1024),
      fft2048: this.measureFFTPerformance(2048),
      dom: this.measureDOMPerformance(),
      mainThread: await this.measureMainThreadBlocking(2000),
      timestamp: new Date().toISOString()
    };

    return audit;
  }

  /**
   * Get production recommendations based on metrics
   * @param {object} audit - Results from runFullAudit()
   * @returns {object} Recommendations and warnings
   */
  generateRecommendations(audit) {
    const recommendations = {
      passed: [],
      warnings: [],
      critical: []
    };

    // Memory analysis
    if (audit.memory.heapPercentUsed > 90) {
      recommendations.critical.push("⚠️ CRITICAL: Heap usage > 90%. App may crash soon.");
    } else if (audit.memory.heapPercentUsed > 70) {
      recommendations.warnings.push("⚠️ WARNING: Heap usage > 70%. Monitor memory leaks.");
    } else {
      recommendations.passed.push("✅ Memory usage healthy (<70%)");
    }

    // FFT performance analysis
    const fft256Time = parseFloat(audit.fft256.averageTimePerCallMs);
    if (fft256Time > 1) {
      recommendations.warnings.push(`⚠️ FFT 256 taking ${fft256Time}ms per call. Consider reducing analysis frequency.`);
    } else {
      recommendations.passed.push(`✅ FFT 256 performance good (${fft256Time}ms per call)`);
    }

    // DOM performance
    const loadTime = audit.dom.loadComplete;
    if (loadTime > 5000) {
      recommendations.warnings.push(`⚠️ Page load time ${(loadTime/1000).toFixed(1)}s. Consider lazy-loading components.`);
    } else {
      recommendations.passed.push(`✅ Page load time acceptable (${(loadTime/1000).toFixed(1)}s)`);
    }

    // Resource size analysis
    const jsSize = parseFloat(audit.dom.resourcesData.javascript.totalKB);
    if (jsSize > 500) {
      recommendations.warnings.push(`⚠️ JavaScript bundle ${jsSize}KB. Consider code splitting.`);
    } else {
      recommendations.passed.push(`✅ JavaScript bundle size good (${jsSize}KB)`);
    }

    // Web Audio latency
    if (audit.webAudio.baseLatency > 0.1) {
      recommendations.warnings.push(`⚠️ Audio latency ${(audit.webAudio.baseLatency * 1000).toFixed(1)}ms. May cause timing issues.`);
    } else {
      recommendations.passed.push(`✅ Audio latency acceptable`);
    }

    return recommendations;
  }

  /**
   * Export results to JSON
   * @param {object} data - Data to export
   * @returns {string} JSON string
   */
  exportJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export results to CSV
   * @param {object} data - Performance metrics
   * @returns {string} CSV format
   */
  exportCSV(data) {
    const lines = [];
    lines.push("Metric,Value,Unit,Timestamp");
    
    const flattenObject = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          flattenObject(value, `${prefix}${key}.`);
        } else {
          lines.push(`"${prefix}${key}","${value}","","${data.timestamp || 'N/A'}"`);
        }
      });
    };

    flattenObject(data);
    return lines.join('\n');
  }
}

// Global profiler instance
window.PerformanceProfiler = new PerformanceProfiler();

// Test scenarios
const PERF_TEST_SCENARIOS = {
  /**
   * Quick memory check (< 1 second)
   */
  quickMemoryCheck: () => {
    const result = window.PerformanceProfiler.measureMemory();
    console.log('📊 Memory Status:');
    console.table(result);
    return result;
  },

  /**
   * FFT performance benchmark (< 5 seconds)
   */
  fftBenchmark: () => {
    console.log('⚡ FFT Performance Benchmark:');
    const results = {
      FFT256: window.PerformanceProfiler.measureFFTPerformance(256),
      FFT512: window.PerformanceProfiler.measureFFTPerformance(512),
      FFT1024: window.PerformanceProfiler.measureFFTPerformance(1024),
      FFT2048: window.PerformanceProfiler.measureFFTPerformance(2048),
    };
    console.table(results);
    return results;
  },

  /**
   * Full audit with recommendations (10-15 seconds)
   */
  fullAudit: async () => {
    const audit = await window.PerformanceProfiler.runFullAudit();
    const recommendations = window.PerformanceProfiler.generateRecommendations(audit);
    
    console.log('='.repeat(60));
    console.log('📈 PERFORMANCE AUDIT RESULTS');
    console.log('='.repeat(60));
    console.log('\n✅ PASSED:');
    recommendations.passed.forEach(msg => console.log(`   ${msg}`));
    
    if (recommendations.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      recommendations.warnings.forEach(msg => console.log(`   ${msg}`));
    }
    
    if (recommendations.critical.length > 0) {
      console.log('\n🔴 CRITICAL:');
      recommendations.critical.forEach(msg => console.log(`   ${msg}`));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Full Audit Data:');
    console.table(audit);
    
    return { audit, recommendations };
  },

  /**
   * Export results
   */
  export: async () => {
    const audit = await window.PerformanceProfiler.runFullAudit();
    const json = window.PerformanceProfiler.exportJSON(audit);
    const csv = window.PerformanceProfiler.exportCSV(audit);
    
    console.log('📥 JSON Export:');
    console.log(json);
    console.log('\n📥 CSV Export:');
    console.log(csv);
    
    return { json, csv };
  }
};

window.PERF_TEST_SCENARIOS = PERF_TEST_SCENARIOS;

console.log(`
╔════════════════════════════════════════════════════════════╗
║  📊 PERFORMANCE PROFILER LOADED                            ║
╠════════════════════════════════════════════════════════════╣
║  Quick checks:                                              ║
║  • window.PERF_TEST_SCENARIOS.quickMemoryCheck()           ║
║  • window.PERF_TEST_SCENARIOS.fftBenchmark()               ║
║                                                             ║
║  Full analysis (10-15 seconds):                            ║
║  • window.PERF_TEST_SCENARIOS.fullAudit()                  ║
║                                                             ║
║  Export results:                                            ║
║  • window.PERF_TEST_SCENARIOS.export()                     ║
║                                                             ║
║  Direct access:                                            ║
║  • window.PerformanceProfiler.measureMemory()              ║
║  • window.PerformanceProfiler.measureFFTPerformance()      ║
║  • window.PerformanceProfiler.measureDOMPerformance()      ║
╚════════════════════════════════════════════════════════════╝
`);
