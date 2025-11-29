/**
 * Test SMS Verification with jobmatch.zip
 * Tests both the SMS sending and verification flow
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');

const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const JOBMATCH_URL = process.env.JOBMATCH_URL || 'https://jobmatch.zip';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

async function testSMSVerification(phoneNumber) {
  console.log(colorize('\n=== Testing SMS Verification with jobmatch.zip ===\n', 'cyan'));
  
  try {
    // Step 1: Request MFA code via SMS
    console.log(colorize('Step 1: Requesting SMS verification code...', 'yellow'));
    console.log(`  Phone: ${phoneNumber}`);
    console.log(`  API: ${MYKEYS_URL}/api/auth/request-mfa-code\n`);
    
    const requestResponse = await axios.post(
      `${MYKEYS_URL}/api/auth/request-mfa-code`,
      { phoneNumber },
      { timeout: 30000 }
    );
    
    if (requestResponse.data.success) {
      console.log(colorize('✓ SMS code requested successfully', 'green'));
      console.log(`  Message: ${requestResponse.data.message || 'Code sent'}\n`);
    } else {
      console.error(colorize('✗ Failed to request SMS code', 'red'));
      console.error(`  Error: ${requestResponse.data.error || 'Unknown error'}`);
      return;
    }
    
    // Step 2: Prompt for code
    console.log(colorize('Step 2: Enter verification code', 'yellow'));
    console.log('  Check your phone for the SMS code\n');
    
    // In a real scenario, you'd wait for user input
    // For testing, we'll simulate with a prompt
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const code = await new Promise((resolve) => {
      rl.question(colorize('Enter 4-digit code: ', 'cyan'), (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    
    if (!code || code.length !== 4) {
      console.error(colorize('✗ Invalid code format', 'red'));
      return;
    }
    
    // Step 3: Verify code
    console.log(colorize('\nStep 3: Verifying code...', 'yellow'));
    console.log(`  Code: ${code}`);
    console.log(`  API: ${MYKEYS_URL}/api/auth/verify-mfa-code\n`);
    
    const verifyResponse = await axios.post(
      `${MYKEYS_URL}/api/auth/verify-mfa-code`,
      {
        phoneNumber,
        code,
        clientId: 'jobmatch-test',
        clientType: 'web',
        expiresInDays: 90,
      },
      { timeout: 30000 }
    );
    
    if (verifyResponse.data.success) {
      console.log(colorize('✓ Verification successful!', 'green'));
      console.log(`  Token: ${verifyResponse.data.token.substring(0, 20)}...`);
      console.log(`  Expires: ${verifyResponse.data.expiresAt}\n`);
      
      // Step 4: Test using token with jobmatch.zip
      console.log(colorize('Step 4: Testing token with jobmatch.zip...', 'yellow'));
      console.log(`  API: ${JOBMATCH_URL}\n`);
      
      // This would be a call to jobmatch.zip API
      // Adjust based on actual jobmatch.zip API endpoints
      try {
        const jobmatchResponse = await axios.get(
          `${JOBMATCH_URL}/api/test-auth`,
          {
            headers: {
              'Authorization': `Bearer ${verifyResponse.data.token}`,
            },
            timeout: 10000,
            validateStatus: () => true, // Don't throw on any status
          }
        );
        
        console.log(`  Status: ${jobmatchResponse.status}`);
        if (jobmatchResponse.status === 200) {
          console.log(colorize('✓ jobmatch.zip accepted the token', 'green'));
        } else {
          console.log(colorize('⚠️  jobmatch.zip returned non-200 status', 'yellow'));
          console.log(`  Response: ${JSON.stringify(jobmatchResponse.data, null, 2)}`);
        }
      } catch (jobmatchError) {
        console.log(colorize('⚠️  Could not reach jobmatch.zip (this is OK if endpoint doesn\'t exist)', 'yellow'));
        console.log(`  Error: ${jobmatchError.message}`);
      }
      
      console.log(colorize('\n✅ SMS verification test complete!', 'green'));
      
    } else {
      console.error(colorize('✗ Verification failed', 'red'));
      console.error(`  Error: ${verifyResponse.data.error || 'Unknown error'}`);
      console.error(`  Message: ${verifyResponse.data.message || ''}`);
    }
    
  } catch (error) {
    console.error(colorize('\n✗ Test failed', 'red'));
    console.error(`  Error: ${error.message}`);
    
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Main
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error(colorize('Usage: node test-sms-jobmatch.js <phone-number>', 'red'));
  console.error(colorize('Example: node test-sms-jobmatch.js +12132484250', 'yellow'));
  process.exit(1);
}

// Validate phone number format (E.164)
if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
  console.error(colorize('✗ Invalid phone number format', 'red'));
  console.error(colorize('  Use E.164 format: +12132484250', 'yellow'));
  process.exit(1);
}

testSMSVerification(phoneNumber).catch(console.error);



