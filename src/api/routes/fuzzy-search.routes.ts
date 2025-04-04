/**
 * Fuzzy Search Routes
 *
 * API routes for fuzzy matching and hierarchical data queries
 */

import { Router } from 'express';
import { FuzzySearchController } from '../controllers/fuzzy-search.controller';

const router = Router();

/**
 * @route   GET /api/fuzzy-search/carriers
 * @desc    Find carriers by fuzzy name matching
 * @access  Public
 * @query   {string} query - The search query
 * @query   {number} [threshold=0.3] - Similarity threshold (0-1)
 * @query   {number} [limit=10] - Maximum number of results
 */
router.get('/carriers', FuzzySearchController.findCarriersByFuzzyName);

/**
 * @route   GET /api/fuzzy-search/procedures
 * @desc    Find procedures by fuzzy code or description matching
 * @access  Public
 * @query   {string} query - The search query
 * @query   {number} [threshold=0.3] - Similarity threshold (0-1)
 * @query   {number} [limit=10] - Maximum number of results
 */
router.get('/procedures', FuzzySearchController.findProceduresByFuzzyMatch);

/**
 * @route   GET /api/fuzzy-search/networks
 * @desc    Find networks by fuzzy name matching
 * @access  Public
 * @query   {string} query - The search query
 * @query   {number} [threshold=0.3] - Similarity threshold (0-1)
 * @query   {number} [limit=10] - Maximum number of results
 */
router.get('/networks', FuzzySearchController.findNetworksByFuzzyName);

/**
 * @route   GET /api/fuzzy-search/hierarchy
 * @desc    Get the complete network-carrier-plan hierarchy
 * @access  Public
 * @query   {boolean} [includeCarriers=true] - Include carriers in the response
 * @query   {boolean} [includePlans=true] - Include plans in the response
 * @query   {string} [filterNetworkIds] - Comma-separated list of network IDs to filter by
 * @query   {string} [filterCarrierIds] - Comma-separated list of carrier IDs to filter by
 * @query   {number} [limit] - Maximum number of networks to return
 */
router.get('/hierarchy', FuzzySearchController.getCompleteHierarchy);

/**
 * @route   GET /api/fuzzy-search/carriers-with-networks
 * @desc    Find carriers by fuzzy name match and include their network relationships
 * @access  Public
 * @query   {string} query - The search query
 * @query   {number} [threshold=0.3] - Similarity threshold (0-1)
 * @query   {number} [limit=10] - Maximum number of results
 */
router.get('/carriers-with-networks', FuzzySearchController.findCarriersByFuzzyNameWithNetworks);

/**
 * @route   GET /api/fuzzy-search/carrier-in-network/:carrierId/:networkId
 * @desc    Check if a carrier belongs to a specific network
 * @access  Public
 * @param   {number} carrierId - The carrier ID
 * @param   {number} networkId - The network ID
 */
router.get('/carrier-in-network/:carrierId/:networkId', FuzzySearchController.isCarrierInNetwork);

/**
 * @route   GET /api/fuzzy-search/full-text
 * @desc    Perform full-text search on guidelines
 * @access  Public
 * @query   {string} query - The search query
 * @query   {number} [limit=10] - Maximum number of results
 * @query   {number} [offset=0] - Number of results to skip
 * @query   {number} [carrierId] - Filter by carrier ID
 * @query   {string} [category] - Filter by category
 * @query   {boolean} [includeHighlights=true] - Include highlighted text snippets
 * @query   {number} [minRank=0.01] - Minimum rank threshold
 */
router.get('/full-text', FuzzySearchController.fullTextSearch);

export default router;
