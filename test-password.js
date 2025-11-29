#!/usr/bin/env node
/**
 * Test Password Verification
 * Tests that "riddle-squiggle" works as partial password
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
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

async function testPassword() {
  console.log(colorize('\n=== Testing Password: riddle-squiggle ===\n', 'cyan'));
  
  console.log(`MYKEYS_PASS: ${MYKEYS_PASS ? MYKEYS_PASS.substring(0, 5) + '...' : 'not set'}`);
  console.log(`API: ${MYKEYS_URL}\n`);
  
  try {
    // Test 1: Verify partial password
    console.log(colorize('Test 1: Verify Partial Password', 'yellow'));
    console.log('  POST /api/auth/verify-partial\n');
    
    const verifyResponse = await axios.post(
      `${MYKEYS_URL}/api/auth/verify-partial`,
      { partialPassword: MYKEYS_PASS },
      { timeout: 10000 }
    );
    
    if (verifyResponse.data.success && verifyResponse.data.code) {
      console.log(colorize('✓ Partial password verified!', 'green'));
      console.log(`  Architect code received: ${verifyResponse.data.code.substring(0, 8)}...\n`);
      
      // Test 2: Generate Bearer token
      console.log(colorize('Test 2: Generate Bearer Token', 'yellow'));
      console.log('  POST /api/mcp/token/generate\n');
      
      const tokenResponse = await axios.post(
        `${MYKEYS_URL}/api/mcp/token/generate`,
        {
          architectCode: verifyResponse.data.code,
          clientId: 'test-cli',
          clientType: 'cli',
          expiresInDays: 1,
        },
        { timeout: 10000 }
      );
      
      if (tokenResponse.data.success && tokenResponse.data.token) {
        console.log(colorize('✓ Bearer token generated!', 'green'));
        console.log(`  Token: ${tokenResponse.data.token.substring(0, 20)}...`);
        console.log(`  Expires: ${tokenResponse.data.expiresAt}\n`);
        
        // Test 3: Use token to access API
        console.log(colorize('Test 3: Use Token to Access API', 'yellow'));
        console.log('  GET /api/health\n');
        
        const healthResponse = await axios.get(
          `${MYKEYS_URL}/api/health`,
          {
            headers: {
              'Authorization': `Bearer ${tokenResponse.data.token}`,
            },
            timeout: 5000,
          }
        );
        
        if (healthResponse.status === 200) {
          console.log(colorize('✓ Token authentication works!', 'green'));
          console.log(`  Status: ${healthResponse.status}\n`);
        }
        
        console.log(colorize('✅ All tests passed!', 'green'));
        console.log(colorize('\nPassword "riddle-squiggle" is working correctly.', 'green'));
        console.log(colorize('You can now run: node store-twilio-credentials.js', 'cyan'));
        
      } else {
        console.error(colorize('✗ Failed to generate token', 'red'));
        console.error(tokenResponse.data);
      }
      
    } else {
      console.error(colorize('✗ Partial password verification failed', 'red'));
      console.error(verifyResponse.data);
      console.log(colorize('\n⚠️  The password "riddle-squiggle" may not be a valid partial.', 'yellow'));
      console.log(colorize('   Check that it matches part of the architect password.', 'yellow'));
    }
    
  } catch (error) {
    console.error(colorize('\n✗ Test failed', 'red'));
    console.error(`  Error: ${error.message}`);
    
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data:`, JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log(colorize('\n⚠️  Authentication failed', 'yellow'));
        console.log(colorize('   The password "riddle-squiggle" may not match.', 'yellow'));
        console.log(colorize('   Verify the architect password in Vercel matches.', 'yellow'));
      }
    }
    
    process.exit(1);
  }
}

testPassword();



