#!/usr/bin/env node
/**
 * Verify production server can access Upstash Redis
 */

const axios = require('axios');

async function verifyProductionRedis() {
  console.log('\n=== Verifying Production Server Redis Access ===\n');
  
  // Test if production server can read from Redis
  // We'll check the /api/secrets endpoint (requires auth, but we can see error messages)
  
  const MYKEYS_URL = 'https://mykeys.zip';
  
  console.log('Testing production server...');
  console.log(`URL: ${MYKEYS_URL}\n`);
  
  // The server should be using Redis now
  // Let's check if it can read ses-credentials
  
  try {
    // This will fail auth, but we can see if Redis is working
    const response = await axios.get(`${MYKEYS_URL}/api/secrets/ses-credentials`, {
      headers: { 'Authorization': 'Bearer invalid-token' },
      timeout: 5000,
      validateStatus: () => true, // Don't throw on any status
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.status === 401) {
      console.log('\n✓ Server is responding (auth required as expected)');
      console.log('  The server should be able to read from Redis once authenticated');
    } else if (response.status === 404) {
      console.log('\n⚠️  Secret not found - server might not be reading from Redis');
    } else if (response.status === 500) {
      console.log('\n❌ Server error - check logs');
      console.log('  Error:', response.data?.error);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\nNote: Credentials are stored in Upstash Redis');
  console.log('Production server should read them using KV_REST_API_URL/TOKEN');
  console.log('Check Vercel logs if issues persist\n');
}

verifyProductionRedis().catch(console.error);




