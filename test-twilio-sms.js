#!/usr/bin/env node
/**
 * Twilio SMS Diagnostic Tool
 * 
 * Tests Twilio SMS functionality and helps diagnose issues
 * 
 * Usage:
 *   node test-twilio-sms.js
 *   node test-twilio-sms.js --phone +12132484250
 */

const https = require('https');
const readline = require('readline');

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const MYKEYS_USER = process.env.MYKEYS_USER || 'admin';
const MYKEYS_PASS = process.env.MYKEYS_PASS || 'riddle-squiggle@#$34alkdjf';

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color] || colors.reset}${text}${colors.reset}`;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

// Make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = options.body ? JSON.stringify(options.body) : null;
    const auth = options.auth ? Buffer.from(options.auth).toString('base64') : null;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(auth ? { 'Authorization': `Basic ${auth}` } : {}),
        ...(options.headers || {}),
      },
      timeout: options.timeout || 30000,
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers,
            raw: body,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: { error: 'Invalid JSON response', raw: body },
            headers: res.headers,
            raw: body,
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// Normalize phone number
function normalizePhoneNumber(phone) {
  let normalized = phone.trim();

  if (normalized.startsWith('+')) {
    normalized = '+' + normalized.substring(1).replace(/\D/g, '');
  } else {
    const digitsOnly = normalized.replace(/\D/g, '');
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      normalized = '+' + digitsOnly;
    } else if (digitsOnly.length === 10) {
      normalized = '+1' + digitsOnly;
    } else {
      throw new Error('Invalid phone number format');
    }
  }

  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  if (!phoneRegex.test(normalized)) {
    throw new Error('Invalid phone number format');
  }

  return normalized;
}

async function main() {
  try {
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║', 'cyan') + colorize('      Twilio SMS Diagnostic Tool', 'bright') + colorize('      ║', 'cyan'));
    console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
    console.log('');
    console.log(colorize(`API URL: ${MYKEYS_URL}`, 'dim'));
    console.log('');

    // Step 1: Get phone number
    const args = process.argv.slice(2);
    let phoneNumber = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--phone' && i + 1 < args.length) {
        phoneNumber = args[i + 1];
        break;
      }
    }

    if (!phoneNumber) {
      console.log(colorize('Enter phone number to test:', 'bright'));
      console.log(colorize('Formats:', 'dim'));
      console.log('  • +12132484250 (E.164)');
      console.log('  • 12132484250 (11 digits)');
      console.log('  • 213-248-4250 (10 digits)');
      phoneNumber = await prompt(colorize('\nPhone number: ', 'yellow'));
    }

    try {
      phoneNumber = normalizePhoneNumber(phoneNumber);
      console.log(colorize(`✓ Normalized: ${phoneNumber}`, 'green'));
    } catch (error) {
      console.error(colorize('Error:', 'red'), error.message);
      process.exit(1);
    }

    // Step 2: Check Twilio credentials
    console.log('');
    console.log(colorize('Step 1: Checking Twilio credentials...', 'cyan'));
    
    try {
      const credsResponse = await makeRequest(`${MYKEYS_URL}/api/secrets/twilio-credentials`, {
        method: 'GET',
        auth: `${MYKEYS_USER}:${MYKEYS_PASS}`,
        timeout: 10000,
      });

      if (credsResponse.status === 200 && credsResponse.data) {
        const twilio = typeof credsResponse.data === 'string' 
          ? JSON.parse(credsResponse.data) 
          : credsResponse.data;
        
        console.log(colorize('✓ Twilio credentials found', 'green'));
        console.log(colorize(`  Account SID: ${twilio.account_sid ? twilio.account_sid.substring(0, 10) + '...' : 'MISSING'}`, 'dim'));
        console.log(colorize(`  Auth Token: ${twilio.auth_token ? '***' + twilio.auth_token.slice(-4) : 'MISSING'}`, 'dim'));
        console.log(colorize(`  Phone Number: ${twilio.phone_number || 'MISSING'}`, 'dim'));
        
        if (!twilio.account_sid || !twilio.auth_token) {
          console.error(colorize('\n❌ Error:', 'red'), 'Twilio credentials incomplete');
          console.log(colorize('\nRequired fields:', 'yellow'));
          console.log('  • account_sid');
          console.log('  • auth_token');
          console.log('  • phone_number (optional, defaults to +16269959974)');
          process.exit(1);
        }
      } else {
        console.error(colorize('❌ Error:', 'red'), 'Could not retrieve Twilio credentials');
        console.log(colorize('\nTroubleshooting:', 'yellow'));
        console.log('  1. Verify credentials are stored in mykeys.zip');
        console.log('  2. Secret name should be: twilio-credentials');
        console.log('  3. Check MYKEYS_USER and MYKEYS_PASS environment variables');
        console.log('  4. Verify API server is running');
        process.exit(1);
      }
    } catch (error) {
      console.error(colorize('❌ Error:', 'red'), error.message);
      console.log(colorize('\nTroubleshooting:', 'yellow'));
      console.log('  1. Check network connectivity');
      console.log('  2. Verify MYKEYS_URL is correct');
      console.log('  3. Check API server is running');
      process.exit(1);
    }

    // Step 3: Test SMS sending via API
    console.log('');
    console.log(colorize('Step 2: Testing SMS sending...', 'cyan'));
    console.log(colorize(`Sending test code to ${phoneNumber}...`, 'dim'));

    try {
      const testCode = '1234';
      const smsResponse = await makeRequest(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
        method: 'POST',
        body: { phoneNumber },
        timeout: 30000,
      });

      if (smsResponse.status === 200 && smsResponse.data.success) {
        console.log(colorize('✓ SMS request accepted by API', 'green'));
        console.log(colorize(`  Method: ${smsResponse.data.method}`, 'dim'));
        console.log(colorize(`  Target: ${smsResponse.data.target}`, 'dim'));
        console.log(colorize(`  Expires in: ${smsResponse.data.expiresIn} seconds`, 'dim'));
        console.log('');
        console.log(colorize('📱 Check your phone for SMS message', 'bright'));
        console.log(colorize('   The code should arrive within 10-30 seconds', 'dim'));
        console.log('');
        console.log(colorize('Next steps:', 'yellow'));
        console.log('  1. Check your phone for SMS');
        console.log('  2. If SMS received: Twilio is working correctly');
        console.log('  3. If SMS not received: Check Twilio console for errors');
        console.log('  4. Verify phone number is correct');
        console.log('  5. Check Twilio account status and balance');
      } else {
        console.error(colorize('❌ Error:', 'red'), smsResponse.data.error || 'Failed to send SMS');
        console.log(colorize('\nResponse:', 'yellow'));
        console.log(JSON.stringify(smsResponse.data, null, 2));
        console.log(colorize('\nTroubleshooting:', 'yellow'));
        console.log('  1. Check server logs for detailed error');
        console.log('  2. Verify Twilio credentials are correct');
        console.log('  3. Check Twilio account has SMS enabled');
        console.log('  4. Verify phone number format (E.164)');
        console.log('  5. Check Twilio account balance');
        console.log('  6. Verify phone number is verified (for trial accounts)');
        process.exit(1);
      }
    } catch (error) {
      console.error(colorize('❌ Error:', 'red'), error.message);
      console.log(colorize('\nTroubleshooting:', 'yellow'));
      console.log('  1. Check network connectivity');
      console.log('  2. Verify API server is running');
      console.log('  3. Check server logs for detailed error');
      process.exit(1);
    }

    // Step 4: Check Twilio account status (if possible)
    console.log('');
    console.log(colorize('Step 3: Twilio Account Checklist', 'cyan'));
    console.log(colorize('\nPlease verify the following in your Twilio Console:', 'yellow'));
    console.log('');
    console.log('  [ ] Account is active (not suspended)');
    console.log('  [ ] Account has sufficient balance');
    console.log('  [ ] SMS messaging is enabled');
    console.log('  [ ] Phone number is verified (for trial accounts)');
    console.log('  [ ] No restrictions on sending to this number');
    console.log('  [ ] Phone number format is correct (E.164)');
    console.log('');
    console.log(colorize('Twilio Console:', 'dim'));
    console.log('  https://console.twilio.com/');
    console.log('');
    console.log(colorize('Check Message Logs:', 'dim'));
    console.log('  https://console.twilio.com/us1/monitor/logs/sms');
    console.log('');

    console.log(colorize('✓ Diagnostic complete', 'green'));
    console.log('');

  } catch (error) {
    console.error(colorize('\n❌ Fatal error:', 'red'), error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(colorize('Fatal error:', 'red'), error.message);
    process.exit(1);
  });
}

module.exports = { main };






