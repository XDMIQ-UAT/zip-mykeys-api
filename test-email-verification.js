#!/usr/bin/env node
/**
 * Test email verification flow
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const {
  generate2FACode,
  store2FAChallenge,
  generateDeviceFingerprint
} = require('./device-auth');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Email Verification Flow Test         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  const testEmail = 'bcherrman@gmail.com';
  const testUsername = 'test-user';
  
  // Generate test data
  const challengeId = `test-${Date.now()}`;
  const code = generate2FACode();
  const deviceFingerprint = { hostname: 'test-host', username: 'test' };
  const fingerprintHash = generateDeviceFingerprint(deviceFingerprint);
  
  console.log('Test data:');
  console.log(`  Challenge ID: ${challengeId}`);
  console.log(`  Code: ${code}`);
  console.log(`  Email: ${testEmail}`);
  console.log(`  Username: ${testUsername}`);
  console.log('');
  
  console.log('Storing 2FA challenge and sending email...');
  
  try {
    const result = await store2FAChallenge(
      challengeId,
      code,
      fingerprintHash,
      testUsername,
      {
        email: testEmail,
        deliveryMethod: 'email'
      }
    );
    
    console.log('');
    console.log('Result:');
    console.log(`  Email sent: ${result.emailSent ? '✓' : '✗'}`);
    
    if (result.emailSent) {
      console.log('  ✓ Email verification flow is working!');
      console.log('');
      console.log(`Check ${testEmail} for verification code: ${code}`);
    } else {
      console.log(`  ✗ Email failed: ${result.emailError}`);
      console.log('');
      console.log('Troubleshooting:');
      console.log('  1. Check ProtonMail credentials in .env.local');
      console.log('  2. Verify SMTP connection with: node test-email.js');
      console.log('  3. Check email-service.js configuration');
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
