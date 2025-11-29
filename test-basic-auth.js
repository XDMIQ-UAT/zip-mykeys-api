#!/usr/bin/env node
/**
 * Test Basic Auth with riddle-squiggle
 * This should work immediately after setting password in Vercel
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS || 'riddle-squiggle';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function testBasicAuth() {
  console.log(colorize('\n=== Testing Basic Auth ===\n', 'cyan'));
  
  console.log(`Username: ${MYKEYS_USER}`);
  console.log(`Password: ${MYKEYS_PASS}`);
  console.log(`API: ${MYKEYS_URL}\n`);
  
  const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
  
  try {
    // Test 1: Health check
    console.log(colorize('Test 1: Health Check', 'yellow'));
    console.log('  GET /api/health\n');
    
    const healthResponse = await axios.get(
      `${MYKEYS_URL}/api/health`,
      {
        headers: { 'Authorization': `Basic ${auth}` },
        timeout: 5000,
      }
    );
    
    if (healthResponse.status === 200) {
      console.log(colorize('✓ Basic Auth works for health check!', 'green'));
      console.log(`  Status: ${healthResponse.status}\n`);
    }
    
    // Test 2: Access secrets endpoint
    console.log(colorize('Test 2: Access Secrets Endpoint', 'yellow'));
    console.log('  GET /api/secrets\n');
    
    const secretsResponse = await axios.get(
      `${MYKEYS_URL}/api/secrets`,
      {
        headers: { 'Authorization': `Basic ${auth}` },
        timeout: 5000,
        validateStatus: () => true, // Don't throw on any status
      }
    );
    
    if (secretsResponse.status === 200) {
      console.log(colorize('✓ Basic Auth works for /api/secrets!', 'green'));
      console.log(`  Status: ${secretsResponse.status}`);
      console.log(`  Secrets found: ${secretsResponse.data.secrets?.length || 0}\n`);
    } else {
      console.log(colorize(`⚠️  Status: ${secretsResponse.status}`, 'yellow'));
      console.log(`  Response:`, JSON.stringify(secretsResponse.data, null, 2));
    }
    
    console.log(colorize('✅ Basic Auth test complete!', 'green'));
    console.log(colorize('\nIf Basic Auth works, you can use it to store Twilio credentials.', 'cyan'));
    console.log(colorize('The script will be updated to use Basic Auth.', 'cyan'));
    
  } catch (error) {
    console.error(colorize('\n✗ Basic Auth test failed', 'red'));
    console.error(`  Error: ${error.message}`);
    
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log(colorize('\n⚠️  Authentication failed', 'yellow'));
        console.log(colorize('   The password may not have been updated in production yet.', 'yellow'));
        console.log(colorize('   Wait a few minutes and try again, or check Vercel deployment.', 'yellow'));
      }
    }
    
    process.exit(1);
  }
}

testBasicAuth();



