#!/usr/bin/env node
/**
 * MFA CLI Tool - Generate tokens via SMS or Email
 * 
 * This script provides a simple command-line interface for generating
 * MyKeys tokens using Multi-Factor Authentication via SMS (Twilio) or Email (Amazon SES).
 * 
 * Usage:
 *   node mfa-cli.js
 *   node mfa-cli.js --method sms --phone +12132484250
 *   node mfa-cli.js --method email --email user@example.com
 */

const https = require('https');
const readline = require('readline');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Configuration
const MYKEYS_URL = process.env.MYKEYS_URL || 'https://mykeys.zip';
const DEFAULT_CLIENT_TYPE = 'generic';
const DEFAULT_EXPIRES_DAYS = 90;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color] || colors.reset}${text}${colors.reset}`;
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u007f': // Backspace (Mac)
        case '\b': // Backspace (Windows)
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          if (char.charCodeAt(0) >= 32) {
            password += char;
            process.stdout.write('*');
          }
          break;
      }
    };

    process.stdin.on('data', onData);
  });
}

// Make HTTP request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = options.body ? JSON.stringify(options.body) : null;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
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
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: { error: 'Invalid JSON response', raw: body },
            headers: res.headers,
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

// Normalize phone number to E.164 format
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
    } else if (digitsOnly.length > 10) {
      normalized = '+' + digitsOnly;
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

// Validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Request MFA code
async function requestMFACode(phoneNumber, email) {
  try {
    console.log(colorize('\n📤 Requesting verification code...', 'cyan'));
    
    const response = await makeRequest(`${MYKEYS_URL}/api/auth/request-mfa-code`, {
      method: 'POST',
      body: { phoneNumber, email },
      timeout: 30000,
    });

    if (response.status === 200 && response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.error || 'Failed to request MFA code');
    }
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error('Request timeout. Please check your network connection.');
    }
    throw error;
  }
}

// Verify MFA code and generate token
async function verifyMFACode(phoneNumber, email, code, clientId, clientType, expiresInDays) {
  try {
    console.log(colorize('\n🔐 Verifying code and generating token...', 'cyan'));
    
    const response = await makeRequest(`${MYKEYS_URL}/api/auth/verify-mfa-code`, {
      method: 'POST',
      body: {
        phoneNumber,
        email,
        code,
        clientId,
        clientType,
        expiresInDays,
      },
      timeout: 30000,
    });

    if (response.status === 200 && response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.error || 'Failed to verify MFA code');
    }
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error('Request timeout. Please check your network connection.');
    }
    throw error;
  }
}

// Save token to file
function saveToken(token) {
  const tokenDir = path.join(os.homedir(), '.mykeys');
  const tokenFile = path.join(tokenDir, 'token');

  try {
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

    fs.writeFileSync(tokenFile, token, 'utf8');
    return tokenFile;
  } catch (error) {
    console.error(colorize('Warning:', 'yellow'), `Could not save token to file: ${error.message}`);
    return null;
  }
}

// Main MFA flow
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let method = null;
    let phoneNumber = null;
    let email = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--method' && i + 1 < args.length) {
        method = args[i + 1].toLowerCase();
        i++;
      } else if (args[i] === '--phone' && i + 1 < args.length) {
        phoneNumber = args[i + 1];
        i++;
      } else if (args[i] === '--email' && i + 1 < args.length) {
        email = args[i + 1];
        i++;
      }
    }

    // Display header
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'cyan'));
    console.log(colorize('║', 'cyan') + colorize('     MyKeys MFA Token Generator', 'bright') + colorize('      ║', 'cyan'));
    console.log(colorize('╚════════════════════════════════════════╝', 'cyan'));
    console.log('');
    console.log(colorize(`API URL: ${MYKEYS_URL}`, 'dim'));
    console.log('');

    // Step 1: Choose method
    if (!method) {
      console.log(colorize('Choose verification method:', 'bright'));
      console.log('  1. SMS (Twilio) - Phone number');
      console.log('  2. Email (Amazon SES) - Email address');
      console.log('');
      const choice = await prompt(colorize('Enter choice (1 or 2): ', 'yellow'));
      method = choice === '1' ? 'sms' : choice === '2' ? 'email' : null;
    }

    if (method !== 'sms' && method !== 'email') {
      console.error(colorize('Error:', 'red'), 'Invalid method. Please choose 1 (SMS) or 2 (Email).');
      process.exit(1);
    }

    // Step 2: Get phone number or email
    if (method === 'sms') {
      if (!phoneNumber) {
        console.log(colorize('\nPhone Number Formats:', 'dim'));
        console.log('  • +12132484250 (E.164 with country code)');
        console.log('  • 12132484250 (11 digits with US country code)');
        console.log('  • 213-248-4250 (10 digits, US number)');
        phoneNumber = await prompt(colorize('\nEnter phone number: ', 'yellow'));
      }

      try {
        phoneNumber = normalizePhoneNumber(phoneNumber);
        console.log(colorize(`✓ Normalized: ${phoneNumber}`, 'green'));
      } catch (error) {
        console.error(colorize('Error:', 'red'), error.message);
        process.exit(1);
      }
    } else {
      if (!email) {
        email = await prompt(colorize('\nEnter email address: ', 'yellow'));
      }

      if (!validateEmail(email)) {
        console.error(colorize('Error:', 'red'), 'Invalid email format.');
        process.exit(1);
      }
      console.log(colorize(`✓ Email: ${email}`, 'green'));
    }

    // Step 3: Request MFA code
    let mfaResponse;
    try {
      mfaResponse = await requestMFACode(phoneNumber, email);
      console.log(colorize(`✓ Verification code sent to ${phoneNumber || email}`, 'green'));
      console.log(colorize(`  Method: ${mfaResponse.method.toUpperCase()}`, 'dim'));
      console.log(colorize(`  Expires in: ${mfaResponse.expiresIn} seconds`, 'dim'));
    } catch (error) {
      console.error(colorize('\n❌ Error:', 'red'), error.message);
      console.log(colorize('\nTroubleshooting:', 'yellow'));
      console.log('  • Check Twilio credentials are configured (for SMS)');
      console.log('  • Check Amazon SES credentials are configured (for Email)');
      console.log('  • Verify phone number format (E.164)');
      console.log('  • Verify email address is correct');
      console.log('  • Check network connectivity');
      process.exit(1);
    }

    // Step 4: Get verification code
    console.log('');
    const code = await prompt(colorize('Enter verification code: ', 'yellow'));
    
    if (!code || code.length !== 4) {
      console.error(colorize('Error:', 'red'), 'Verification code must be 4 digits.');
      process.exit(1);
    }

    // Step 5: Get client details
    const hostname = os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultClientId = `cli-${hostname}`;
    
    console.log('');
    const clientId = await prompt(colorize(`Enter client ID (default: ${defaultClientId}): `, 'yellow')) || defaultClientId;
    const clientType = await prompt(colorize(`Enter client type (default: ${DEFAULT_CLIENT_TYPE}): `, 'yellow')) || DEFAULT_CLIENT_TYPE;
    const expiresInDays = parseInt(await prompt(colorize(`Enter expiration in days (default: ${DEFAULT_EXPIRES_DAYS}): `, 'yellow')) || DEFAULT_EXPIRES_DAYS.toString());

    // Step 6: Verify code and generate token
    let tokenResponse;
    try {
      tokenResponse = await verifyMFACode(phoneNumber, email, code, clientId, clientType, expiresInDays);
    } catch (error) {
      console.error(colorize('\n❌ Error:', 'red'), error.message);
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        console.log(colorize('\nTroubleshooting:', 'yellow'));
        console.log('  • Verification codes expire after 10 minutes');
        console.log('  • Request a new code if expired');
        console.log('  • Double-check the code you entered');
      }
      process.exit(1);
    }

    // Step 7: Display success and save token
    console.log('');
    console.log(colorize('╔════════════════════════════════════════╗', 'green'));
    console.log(colorize('║', 'green') + colorize('      Token Generated Successfully!', 'bright') + colorize('     ║', 'green'));
    console.log(colorize('╚════════════════════════════════════════╝', 'green'));
    console.log('');
    console.log(colorize('Token:', 'bright'));
    console.log(tokenResponse.token);
    console.log('');
    console.log(colorize(`Expires: ${new Date(tokenResponse.expiresAt).toLocaleString()}`, 'dim'));
    console.log(colorize(`Client ID: ${tokenResponse.clientId}`, 'dim'));
    console.log(colorize(`Client Type: ${tokenResponse.clientType}`, 'dim'));
    console.log('');

    // Save token
    const tokenFile = saveToken(tokenResponse.token);
    if (tokenFile) {
      console.log(colorize(`✓ Token saved to: ${tokenFile}`, 'green'));
      console.log('');
      console.log(colorize('You can now use:', 'dim'));
      console.log('  • Set environment variable: export MCP_TOKEN="' + tokenResponse.token + '"');
      console.log('  • Use in scripts: node mykeys-cli.js admin');
    }

    console.log('');
    process.exit(0);
  } catch (error) {
    console.error(colorize('\n❌ Unexpected error:', 'red'), error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error(colorize('Fatal error:', 'red'), error.message);
    process.exit(1);
  });
}

module.exports = { main, requestMFACode, verifyMFACode };





