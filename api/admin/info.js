/**
 * Vercel Serverless Function: Admin Info
 * GET /api/admin/info
 * Returns admin information based on authenticated token
 */

const { validateMCPToken } = require('../../token-auth');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract and validate token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    
    // Validate token
    const validation = await validateMCPToken(token);
    if (!validation.valid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: validation.reason || 'Invalid token'
      });
    }

    // Build admin info response
    const adminInfo = {
      role: 'architect', // Based on token validation
      context: 'mykeys-cli',
      tokenInfo: {
        clientId: validation.clientId,
        clientType: validation.clientType,
        expiresAt: validation.expiresAt,
      },
      permissions: [
        'secrets:read',
        'secrets:write',
        'tokens:generate',
        'admin:view'
      ],
      stats: {
        secretsCount: 0, // TODO: Query from storage
        tokensCount: 0,  // TODO: Query from storage
      }
    };

    return res.status(200).json(adminInfo);
  } catch (error) {
    console.error('Admin info error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
