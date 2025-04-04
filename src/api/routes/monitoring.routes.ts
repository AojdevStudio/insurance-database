/**
 * Monitoring Routes
 * 
 * Routes for monitoring performance and data consistency
 */

import express from 'express';
import { PerformanceMonitorService } from '../../services/performance-monitor.service';
import { DataValidatorService } from '../../services/data-validator.service';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { RollbackService } from '../../services/rollback.service';
import { AlertService, AlertSeverity } from '../../services/alert.service';
import { logger } from '../utils/logger';

// Create router
const router = express.Router();

/**
 * @route   GET /api/monitoring/metrics
 * @desc    Get performance metrics
 * @access  Private
 */
router.get('/metrics', (req, res) => {
  try {
    // Get performance summary
    const metrics = PerformanceMonitorService.getPerformanceSummary();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance metrics'
    });
  }
});

/**
 * @route   GET /api/monitoring/metrics/:operationName
 * @desc    Get performance metrics for a specific operation
 * @access  Private
 */
router.get('/metrics/:operationName', (req, res) => {
  try {
    const { operationName } = req.params;
    const { limit } = req.query;
    
    // Get metrics for the operation
    const oldMetrics = PerformanceMonitorService.getMetrics(
      `${operationName}_old`,
      limit ? parseInt(limit as string, 10) : undefined
    );
    
    const prismaMetrics = PerformanceMonitorService.getMetrics(
      `${operationName}_prisma`,
      limit ? parseInt(limit as string, 10) : undefined
    );
    
    // Get comparison
    const comparison = PerformanceMonitorService.compareMetrics(
      `${operationName}_old`,
      `${operationName}_prisma`
    );
    
    res.json({
      success: true,
      operationName,
      comparison,
      metrics: {
        old: oldMetrics,
        prisma: prismaMetrics
      }
    });
  } catch (error) {
    logger.error('Error getting operation metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operation metrics'
    });
  }
});

/**
 * @route   DELETE /api/monitoring/metrics
 * @desc    Clear all performance metrics
 * @access  Private
 */
router.delete('/metrics', (req, res) => {
  try {
    PerformanceMonitorService.clearMetrics();
    
    res.json({
      success: true,
      message: 'Performance metrics cleared'
    });
  } catch (error) {
    logger.error('Error clearing performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear performance metrics'
    });
  }
});

/**
 * @route   GET /api/monitoring/validation
 * @desc    Get validation results
 * @access  Private
 */
router.get('/validation', (req, res) => {
  try {
    // Get validation summary
    const summary = DataValidatorService.getValidationSummary();
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Error getting validation results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get validation results'
    });
  }
});

/**
 * @route   GET /api/monitoring/validation/:operationName
 * @desc    Get validation results for a specific operation
 * @access  Private
 */
router.get('/validation/:operationName', (req, res) => {
  try {
    const { operationName } = req.params;
    const { limit } = req.query;
    
    // Get validation results for the operation
    const results = DataValidatorService.getValidationResults(
      operationName,
      limit ? parseInt(limit as string, 10) : undefined
    );
    
    res.json({
      success: true,
      operationName,
      results
    });
  } catch (error) {
    logger.error('Error getting operation validation results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get operation validation results'
    });
  }
});

/**
 * @route   DELETE /api/monitoring/validation
 * @desc    Clear all validation results
 * @access  Private
 */
router.delete('/validation', (req, res) => {
  try {
    DataValidatorService.clearValidationResults();
    
    res.json({
      success: true,
      message: 'Validation results cleared'
    });
  } catch (error) {
    logger.error('Error clearing validation results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear validation results'
    });
  }
});

/**
 * @route   GET /api/monitoring/flags
 * @desc    Get feature flags
 * @access  Private
 */
router.get('/flags', (req, res) => {
  try {
    // Get all feature flags
    const flags = FeatureFlagService.getAllFlags();
    
    res.json({
      success: true,
      flags
    });
  } catch (error) {
    logger.error('Error getting feature flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get feature flags'
    });
  }
});

/**
 * @route   PUT /api/monitoring/flags/:flagName
 * @desc    Update a feature flag
 * @access  Private
 */
router.put('/flags/:flagName', (req, res) => {
  try {
    const { flagName } = req.params;
    const { value } = req.body;
    
    if (value === undefined || typeof value !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Value must be a boolean'
      });
    }
    
    // Update the feature flag
    FeatureFlagService.setFlag(flagName, value);
    
    // Log the change
    logger.info(`Feature flag ${flagName} set to ${value}`);
    
    // Send an alert
    AlertService.sendAlert(
      AlertSeverity.INFO,
      'FeatureFlags',
      `Feature flag ${flagName} set to ${value}`,
      { flagName, value }
    );
    
    res.json({
      success: true,
      flagName,
      value
    });
  } catch (error) {
    logger.error('Error updating feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feature flag'
    });
  }
});

/**
 * @route   GET /api/monitoring/rollout
 * @desc    Get rollout status
 * @access  Private
 */
router.get('/rollout', (req, res) => {
  try {
    // Get current phase
    const currentPhase = RollbackService.getCurrentPhase();
    
    // Get traffic percentage
    const trafficPercentage = RollbackService.getCurrentTrafficPercentage();
    
    // Get all phases
    const phases = RollbackService.getAllPhases();
    
    res.json({
      success: true,
      currentPhase,
      trafficPercentage,
      phases
    });
  } catch (error) {
    logger.error('Error getting rollout status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rollout status'
    });
  }
});

/**
 * @route   PUT /api/monitoring/rollout/phase/:phase
 * @desc    Set rollout phase
 * @access  Private
 */
router.put('/rollout/phase/:phase', (req, res) => {
  try {
    const { phase } = req.params;
    
    // Set the rollout phase
    const success = RollbackService.rollbackToPhase(phase);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: `Invalid rollout phase: ${phase}`
      });
    }
    
    // Log the change
    logger.info(`Rollout phase set to ${phase}`);
    
    // Send an alert
    AlertService.sendAlert(
      AlertSeverity.INFO,
      'Rollout',
      `Rollout phase set to ${phase}`,
      { phase }
    );
    
    res.json({
      success: true,
      phase,
      trafficPercentage: RollbackService.getCurrentTrafficPercentage()
    });
  } catch (error) {
    logger.error('Error setting rollout phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set rollout phase'
    });
  }
});

/**
 * @route   POST /api/monitoring/rollout/advance
 * @desc    Advance to next rollout phase
 * @access  Private
 */
router.post('/rollout/advance', (req, res) => {
  try {
    // Advance to the next phase
    const success = RollbackService.advanceToNextPhase();
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'No next phase available'
      });
    }
    
    // Get current phase
    const currentPhase = RollbackService.getCurrentPhase();
    
    // Log the change
    logger.info(`Advanced to rollout phase ${currentPhase}`);
    
    // Send an alert
    AlertService.sendAlert(
      AlertSeverity.INFO,
      'Rollout',
      `Advanced to rollout phase ${currentPhase}`,
      { phase: currentPhase }
    );
    
    res.json({
      success: true,
      phase: currentPhase,
      trafficPercentage: RollbackService.getCurrentTrafficPercentage()
    });
  } catch (error) {
    logger.error('Error advancing rollout phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to advance rollout phase'
    });
  }
});

/**
 * @route   POST /api/monitoring/rollout/rollback
 * @desc    Rollback to old implementation
 * @access  Private
 */
router.post('/rollout/rollback', (req, res) => {
  try {
    // Rollback to old implementation
    RollbackService.rollbackToOldImplementation();
    
    // Log the change
    logger.info('Rolled back to old implementation');
    
    // Send an alert
    AlertService.sendAlert(
      AlertSeverity.WARNING,
      'Rollout',
      'Rolled back to old implementation',
      {}
    );
    
    res.json({
      success: true,
      message: 'Rolled back to old implementation'
    });
  } catch (error) {
    logger.error('Error rolling back to old implementation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback to old implementation'
    });
  }
});

/**
 * @route   GET /api/monitoring/alerts
 * @desc    Get recent alerts
 * @access  Private
 */
router.get('/alerts', (req, res) => {
  try {
    const { limit, severity, source } = req.query;
    
    // Get recent alerts
    const alerts = AlertService.getRecentAlerts(
      limit ? parseInt(limit as string, 10) : undefined,
      severity as AlertSeverity,
      source as string
    );
    
    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    logger.error('Error getting alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts'
    });
  }
});

/**
 * @route   DELETE /api/monitoring/alerts
 * @desc    Clear all alerts
 * @access  Private
 */
router.delete('/alerts', (req, res) => {
  try {
    AlertService.clearAlerts();
    
    res.json({
      success: true,
      message: 'Alerts cleared'
    });
  } catch (error) {
    logger.error('Error clearing alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear alerts'
    });
  }
});

export default router;
