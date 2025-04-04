/**
 * Performance Monitor Service
 * 
 * Service for monitoring and comparing performance between implementations
 */

/**
 * Performance metric
 */
interface PerformanceMetric {
  value: number;
  timestamp: Date;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance comparison result
 */
interface PerformanceComparison {
  oldAvg: number;
  newAvg: number;
  oldMedian: number;
  newMedian: number;
  oldP95: number;
  newP95: number;
  diffPercent: number;
  isFaster: boolean;
  sampleSize: {
    old: number;
    new: number;
  };
}

/**
 * Service for monitoring and comparing performance
 */
export class PerformanceMonitorService {
  /**
   * Performance metrics
   * @private
   */
  private static metrics: Record<string, PerformanceMetric[]> = {};
  
  /**
   * Maximum number of metrics to store per operation
   * @private
   */
  private static readonly MAX_METRICS_PER_OPERATION = 1000;
  
  /**
   * Record a performance metric
   * @param name - Metric name
   * @param value - Metric value (usually duration in ms)
   * @param requestId - Optional request ID
   * @param metadata - Optional metadata
   */
  static recordMetric(
    name: string,
    value: number,
    requestId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    
    // Add the metric
    this.metrics[name].push({
      value,
      timestamp: new Date(),
      requestId,
      metadata
    });
    
    // Trim the metrics array if it gets too large
    if (this.metrics[name].length > this.MAX_METRICS_PER_OPERATION) {
      this.metrics[name] = this.metrics[name].slice(-this.MAX_METRICS_PER_OPERATION);
    }
  }
  
  /**
   * Get metrics for a specific name
   * @param name - Metric name
   * @param limit - Maximum number of metrics to return
   * @returns Array of metrics
   */
  static getMetrics(name: string, limit?: number): PerformanceMetric[] {
    const metrics = this.metrics[name] || [];
    
    if (limit && limit > 0) {
      return metrics.slice(-limit);
    }
    
    return metrics;
  }
  
  /**
   * Clear metrics
   * @param name - Optional metric name (if not provided, all metrics are cleared)
   */
  static clearMetrics(name?: string): void {
    if (name) {
      delete this.metrics[name];
    } else {
      this.metrics = {};
    }
  }
  
  /**
   * Calculate percentile
   * @param values - Array of values
   * @param percentile - Percentile (0-100)
   * @returns Percentile value
   * @private
   */
  private static calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
  
  /**
   * Compare metrics between old and new implementations
   * @param oldName - Metric name for old implementation
   * @param newName - Metric name for new implementation
   * @param limit - Optional limit for number of metrics to compare
   * @returns Performance comparison
   */
  static compareMetrics(
    oldName: string,
    newName: string,
    limit?: number
  ): PerformanceComparison {
    const oldMetrics = this.getMetrics(oldName, limit).map(m => m.value);
    const newMetrics = this.getMetrics(newName, limit).map(m => m.value);
    
    if (oldMetrics.length === 0 || newMetrics.length === 0) {
      return {
        oldAvg: 0,
        newAvg: 0,
        oldMedian: 0,
        newMedian: 0,
        oldP95: 0,
        newP95: 0,
        diffPercent: 0,
        isFaster: false,
        sampleSize: {
          old: oldMetrics.length,
          new: newMetrics.length
        }
      };
    }
    
    // Calculate average
    const oldAvg = oldMetrics.reduce((a, b) => a + b, 0) / oldMetrics.length;
    const newAvg = newMetrics.reduce((a, b) => a + b, 0) / newMetrics.length;
    
    // Calculate median (50th percentile)
    const oldMedian = this.calculatePercentile(oldMetrics, 50);
    const newMedian = this.calculatePercentile(newMetrics, 50);
    
    // Calculate 95th percentile
    const oldP95 = this.calculatePercentile(oldMetrics, 95);
    const newP95 = this.calculatePercentile(newMetrics, 95);
    
    // Calculate percentage difference
    const diffPercent = ((oldAvg - newAvg) / oldAvg) * 100;
    
    // Determine if new implementation is faster
    const isFaster = newAvg < oldAvg;
    
    return {
      oldAvg,
      newAvg,
      oldMedian,
      newMedian,
      oldP95,
      newP95,
      diffPercent,
      isFaster,
      sampleSize: {
        old: oldMetrics.length,
        new: newMetrics.length
      }
    };
  }
  
  /**
   * Get all metric names
   * @returns Array of metric names
   */
  static getMetricNames(): string[] {
    return Object.keys(this.metrics);
  }
  
  /**
   * Get performance summary for all metrics
   * @returns Performance summary
   */
  static getPerformanceSummary(): Record<string, PerformanceComparison> {
    const summary: Record<string, PerformanceComparison> = {};
    
    // Get all unique operation names (without _old or _prisma suffix)
    const operationNames = new Set<string>();
    for (const name of this.getMetricNames()) {
      const match = name.match(/^(.+)_(old|prisma)$/);
      if (match) {
        operationNames.add(match[1]);
      }
    }
    
    // Compare metrics for each operation
    for (const op of operationNames) {
      summary[op] = this.compareMetrics(`${op}_old`, `${op}_prisma`);
    }
    
    return summary;
  }
}
