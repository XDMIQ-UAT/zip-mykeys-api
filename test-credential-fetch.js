#!/usr/bin/env node
/**
 * Test Credential Fetch from mykeys.zip API
 * 
 * Verifies that the server can fetch credentials from mykeys.zip API
 * using Tier 1 bootstrap credentials (MYKEYS_PASS)
 */

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function testCredentialFetch(secretName) {
  console.log(colorize(`\n=== Testing ${secretName} Fetch ===\n`, 'bright'));
  
  // Step 1: Check Tier 1 bootstrap credentials
  console.log(colorize('Step 1: Checking Tier 1 bootstrap credentials...', 'cyan'));
  if (!MYKEYS_PASS) {
    console.error(colorize('✗ MYKEYS_PASS not set', 'red'));
    console.log('\nSet Tier 1 bootstrap credential:');
    console.log('  export MYKEYS_PASS=your-password');
    return false;
  }
  console.log(colorize('✓ MYKEYS_PASS is set', 'green'));
  console.log(colorize(`✓ MYKEYS_URL: ${MYKEYS_URL}`, 'green'));
  console.log(colorize(`✓ MYKEYS_USER: ${MYKEYS_USER}`, 'green'));
  
  // Step 2: Fetch from mykeys.zip API (Tier 2)
  console.log(colorize(`\nStep 2: Fetching ${secretName} from mykeys.zip API...`, 'cyan'));
  try {
    const auth = Buffer.from(`${MYKEYS_USER}:${MYKEYS_PASS}`).toString('base64');
    const response = await axios.get(`${MYKEYS_URL}/api/secrets/${secretName}`, {
      headers: { 'Authorization': `Basic ${auth}` },
      timeout: 10000,
    });
    
    if (response.data && response.data.value) {
      console.log(colorize(`✓ Successfully fetched ${secretName}`, 'green'));
      
      // Try to parse as JSON
      try {
        const credentials = JSON.parse(response.data.value);
        console.log(colorize('\nCredentials structure:', 'cyan'));
        Object.keys(credentials).forEach(key => {
          const value = credentials[key];
          const displayValue = key.includes('password') || key.includes('token') || key.includes('secret')
            ? '***' + (value ? value.slice(-4) : '')
            : value;
          console.log(`  ${key}: ${displayValue}`);
        });
        return true;
      } catch (parseError) {
        console.log(colorize(`✓ Credential fetched (not JSON): ${response.data.value.substring(0, 50)}...`, 'green'));
        return true;
      }
    } else {
      console.error(colorize(`✗ ${secretName} not found in response`, 'red'));
      console.log('Response:', response.data);
      return false;
    }
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        console.error(colorize('✗ Authentication failed', 'red'));
        console.log('Check MYKEYS_USER and MYKEYS_PASS are correct');
      } else if (error.response.status === 404) {
        console.error(colorize(`✗ ${secretName} not found in mykeys.zip API`, 'red'));
        console.log(`\nStore ${secretName} in mykeys.zip API:`);
        console.log(`  curl -u admin:\$MYKEYS_PASS -X POST ${MYKEYS_URL}/api/secrets \\`);
        console.log(`    -H "Content-Type: application/json" \\`);
        console.log(`    -d '{"name": "${secretName}", "value": "..."}'`);
      } else {
        console.error(colorize(`✗ HTTP ${error.response.status}:`, 'red'), error.response.data);
      }
    } else {
      console.error(colorize('✗ Network error:', 'red'), error.message);
      console.log('Check network connectivity to', MYKEYS_URL);
    }
    return false;
  }
}

async function main() {
  console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║', 'cyan') + colorize('  Credential Fetch Test (Tier 2)', 'bright') + colorize('         ║', 'cyan'));
  console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
  
  const secrets = process.argv.slice(2);
  const secretsToTest = secrets.length > 0 ? secrets : ['ses-credentials', 'twilio-credentials'];
  
  let allPassed = true;
  
  for (const secretName of secretsToTest) {
    const passed = await testCredentialFetch(secretName);
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log('');
  if (allPassed) {
    console.log(colorize('=== All Tests Passed! ===', 'green'));
    console.log(colorize('\nArchitecture is working correctly:', 'bright'));
    console.log('  Tier 1: Bootstrap credentials (MYKEYS_PASS) ✓');
    console.log('  Tier 2: Application credentials from mykeys.zip API ✓');
  } else {
    console.log(colorize('=== Some Tests Failed ===', 'red'));
    console.log(colorize('\nFix the issues above and try again.', 'yellow'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(colorize('\n✗ Fatal error:', 'red'), error.message);
  console.error(error.stack);
  process.exit(1);
});




