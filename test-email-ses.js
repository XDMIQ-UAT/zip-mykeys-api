/**
 * Test script for AWS SES email service
 * Tests sending a verification code via email using AWS SES SDK
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { sendAuthCode, testConnection } = require('./email-service');

async function testEmailService() {
  console.log('\n=== Testing AWS SES Email Service ===\n');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log(`  AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing'}`);
  console.log(`  AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`  AWS_REGION: ${process.env.AWS_REGION || 'us-east-1 (default)'}`);
  console.log(`  SES_SENDER_EMAIL: ${process.env.SES_SENDER_EMAIL || 'hello@cosmiciq.org (default)'}`);
  console.log('');
  
  // Test connection
  console.log('1. Testing SES connection...');
  try {
    const connectionResult = await testConnection();
    if (connectionResult.success) {
      console.log('   ✓ Connection successful!\n');
    } else {
      console.log(`   ✗ Connection failed: ${connectionResult.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`   ✗ Connection error: ${error.message}\n`);
    process.exit(1);
  }
  
  // Test sending email
  const testEmail = process.argv[2] || process.env.TEST_EMAIL;
  if (!testEmail) {
    console.log('2. Skipping email send test (no email provided)');
    console.log('   Usage: node test-email-ses.js <your-email@example.com>');
    console.log('   Or set TEST_EMAIL environment variable\n');
    process.exit(0);
  }
  
  console.log(`2. Sending test email to ${testEmail}...`);
  const testCode = Math.floor(1000 + Math.random() * 9000).toString();
  
  try {
    const result = await sendAuthCode(testEmail, testCode, 'Test User');
    console.log(`   ✓ Email sent successfully!`);
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   Code: ${testCode}`);
    console.log(`   To: ${result.to}\n`);
    console.log('   Check your inbox for the verification code.\n');
  } catch (error) {
    console.log(`   ✗ Failed to send email: ${error.message}\n`);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

testEmailService().catch((error) => {
  console.error('\n✗ Test failed:', error.message);
  console.error(error);
  process.exit(1);
});


