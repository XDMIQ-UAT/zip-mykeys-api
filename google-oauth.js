/**
 * Google OAuth for MyKeys.zip UI Security
 * 
 * Verifies Google authentication and ensures the authenticated email
 * matches the token's email for admin access
 */

const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client
let oauth2Client = null;

function initializeGoogleOAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  
  // Use production URL by default, fallback to localhost for dev
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const defaultRedirectUri = isProduction 
    ? 'https://mykeys.zip/oauth2callback'
    : 'http://localhost:5173/oauth2callback';
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || defaultRedirectUri;
  
  if (!clientId || !clientSecret) {
    console.warn('[google-oauth] Google OAuth credentials not configured. OAuth will be disabled.');
    return null;
  }
  
  oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return oauth2Client;
}

// Initialize on module load
initializeGoogleOAuth();

/**
 * Get Google OAuth authorization URL
 * @returns {string} Authorization URL
 */
function getAuthUrl() {
  if (!oauth2Client) {
    throw new Error('Google OAuth not configured');
  }
  
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Verify Google OAuth token and get user info
 * @param {string} code - Authorization code from Google
 * @returns {Promise<{email: string, name: string, picture: string}>}
 */
async function verifyGoogleToken(code) {
  if (!oauth2Client) {
    throw new Error('Google OAuth not configured');
  }
  
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      verified: payload.email_verified,
      idToken: tokens.id_token // Return ID token for subsequent API calls
    };
  } catch (error) {
    console.error('[google-oauth] Error verifying Google token:', error.message);
    throw new Error(`Failed to verify Google token: ${error.message}`);
  }
}

/**
 * Verify Google ID token (for client-side verification)
 * @param {string} idToken - Google ID token from client
 * @returns {Promise<{email: string, name: string, picture: string}>}
 */
async function verifyIdToken(idToken) {
  if (!oauth2Client) {
    throw new Error('Google OAuth not configured');
  }
  
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      verified: payload.email_verified
    };
  } catch (error) {
    console.error('[google-oauth] Error verifying ID token:', error.message);
    throw new Error(`Failed to verify ID token: ${error.message}`);
  }
}

module.exports = {
  getAuthUrl,
  verifyGoogleToken,
  verifyIdToken,
  initializeGoogleOAuth,
  isConfigured: () => oauth2Client !== null
};

