// Monitoring constants
const METRICS_PREFIX = 'openai_edge';

interface MetricLabels {
  operation: string;
  status: string;
  model?: string;
}

interface RequestMetrics {
  duration: number;
  tokens?: number;
  status: string;
}

export async function trackRequestMetrics(
  operation: string,
  metrics: RequestMetrics,
  model?: string
): Promise<void> {
  const labels: MetricLabels = {
    operation,
    status: metrics.status,
    model,
  };

  try {
    // Log metrics
    console.log(JSON.stringify({
      type: 'metric',
      name: `${METRICS_PREFIX}_request_duration_ms`,
      value: metrics.duration,
      labels,
    }));

    if (metrics.tokens) {
      console.log(JSON.stringify({
        type: 'metric',
        name: `${METRICS_PREFIX}_tokens_total`,
        value: metrics.tokens,
        labels,
      }));
    }
  } catch (error) {
    // Don't let monitoring errors affect the main flow
    console.error('Error tracking metrics:', error);
  }
}

export function trackError(error: Error, operation: string): void {
  try {
    console.error(JSON.stringify({
      type: 'error',
      operation,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }));
  } catch (e) {
    // Fallback to basic error logging
    console.error('Error logging error:', e);
    console.error('Original error:', error);
  }
} 