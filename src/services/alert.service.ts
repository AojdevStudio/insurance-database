/**
 * Alert Service
 * 
 * Service for sending alerts when issues are detected
 */

import { logger } from '../api/utils/logger';

/**
 * Alert handler function
 */
type AlertHandler = (message: string, data: any) => void;

/**
 * Alert severity level
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert data
 */
export interface AlertData {
  timestamp: Date;
  severity: AlertSeverity;
  source: string;
  message: string;
  data?: any;
}

/**
 * Service for sending alerts
 */
export class AlertService {
  /**
   * Alert handlers
   * @private
   */
  private static alertHandlers: Record<string, AlertHandler> = {};
  
  /**
   * Recent alerts
   * @private
   */
  private static recentAlerts: AlertData[] = [];
  
  /**
   * Maximum number of recent alerts to store
   * @private
   */
  private static readonly MAX_RECENT_ALERTS = 100;
  
  /**
   * Register an alert handler
   * @param type - Handler type
   * @param handler - Alert handler function
   */
  static registerHandler(
    type: string,
    handler: AlertHandler
  ): void {
    this.alertHandlers[type] = handler;
    logger.info(`Registered alert handler: ${type}`);
  }
  
  /**
   * Send an alert
   * @param severity - Alert severity
   * @param source - Alert source
   * @param message - Alert message
   * @param data - Optional alert data
   */
  static sendAlert(
    severity: AlertSeverity,
    source: string,
    message: string,
    data?: any
  ): void {
    // Create alert data
    const alertData: AlertData = {
      timestamp: new Date(),
      severity,
      source,
      message,
      data
    };
    
    // Store the alert
    this.storeAlert(alertData);
    
    // Log the alert
    this.logAlert(alertData);
    
    // Send the alert to all handlers
    for (const [type, handler] of Object.entries(this.alertHandlers)) {
      try {
        handler(message, alertData);
      } catch (error) {
        logger.error(`Error in alert handler ${type}:`, error);
      }
    }
  }
  
  /**
   * Store an alert in the recent alerts list
   * @param alertData - Alert data
   * @private
   */
  private static storeAlert(alertData: AlertData): void {
    this.recentAlerts.push(alertData);
    
    // Trim the alerts array if it gets too large
    if (this.recentAlerts.length > this.MAX_RECENT_ALERTS) {
      this.recentAlerts = this.recentAlerts.slice(-this.MAX_RECENT_ALERTS);
    }
  }
  
  /**
   * Log an alert
   * @param alertData - Alert data
   * @private
   */
  private static logAlert(alertData: AlertData): void {
    const { severity, source, message, data } = alertData;
    
    switch (severity) {
      case AlertSeverity.INFO:
        logger.info(`[${source}] ${message}`, data);
        break;
      case AlertSeverity.WARNING:
        logger.warn(`[${source}] ${message}`, data);
        break;
      case AlertSeverity.ERROR:
      case AlertSeverity.CRITICAL:
        logger.error(`[${source}] ${message}`, data);
        break;
    }
  }
  
  /**
   * Get recent alerts
   * @param limit - Maximum number of alerts to return
   * @param severity - Optional severity filter
   * @param source - Optional source filter
   * @returns Recent alerts
   */
  static getRecentAlerts(
    limit?: number,
    severity?: AlertSeverity,
    source?: string
  ): AlertData[] {
    let alerts = [...this.recentAlerts];
    
    // Apply severity filter
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Apply source filter
    if (source) {
      alerts = alerts.filter(alert => alert.source === source);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit
    if (limit && limit > 0) {
      alerts = alerts.slice(0, limit);
    }
    
    return alerts;
  }
  
  /**
   * Clear all alerts
   */
  static clearAlerts(): void {
    this.recentAlerts = [];
  }
  
  /**
   * Initialize default handlers
   */
  static initialize(): void {
    // Console handler
    this.registerHandler('console', (message, data) => {
      // Already logged by logAlert, so no need to do anything here
    });
    
    // Add more handlers as needed (email, Slack, etc.)
  }
}
