#!/usr/bin/env node
/**
 * Verify Password in Production
 * Tests different password variations to see which one works
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';

// Test different password variations
const passwordsToTest = [
  'riddle-squiggle@#',
  'riddle-squiggle@',
  'riddle-squiggle',
  '"riddle-squiggle@#"',
];

console.log('\n=== Password Verification Test ===\n');
console.log(`Testing against: ${MYKEYS_URL}\n`);

async function testPassword(password) {
  const auth = Buffer.from(`${MYKEYS_USER}:${password}`).toString('base64');
  
  try {
    const response = await axios.post(
      `${MYKEYS_URL}/api/mcp/token/generate-legacy`,
      {
        clientId: 'test-cli',
        clientType: 'cli',
        expiresInDays: 1,
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
        validateStatus: () => true,
      }
    );
    
    if (response.status === 200 && response.data.success) {
      return { success: true, password };
    }
    return { success: false, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status || 'error',
      error: error.message 
    };
  }
}

async function runTests() {
  console.log('Testing password variations...\n');
  
  for (const password of passwordsToTest) {
    const displayPassword = password.length > 20 
      ? password.substring(0, 20) + '...' 
      : password;
    
    process.stdout.write(`Testing: "${displayPassword}" ... `);
    const result = await testPassword(password);
    
    if (result.success) {
      console.log('✓ SUCCESS!');
      console.log(`\n✅ Working password: "${password}"`);
      console.log(`\nUpdate your .env.local to:`);
      console.log(`MYKEYS_PASS="${password}"`);
      return;
    } else {
      console.log(`✗ Failed (${result.status})`);
    }
  }
  
  console.log('\n❌ None of the password variations worked.');
  console.log('\nPossible issues:');
  console.log('  1. Deployment hasn\'t picked up the new password yet');
  console.log('  2. Need to trigger a redeploy in Vercel');
  console.log('  3. Password format might be different in Vercel');
  console.log('\nNext steps:');
  console.log('  1. Go to Vercel dashboard');
  console.log('  2. Verify MYKEYS_PASS is set correctly');
  console.log('  3. Trigger a redeploy');
  console.log('  4. Run this script again');
}

runTests();



