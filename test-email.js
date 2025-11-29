#!/usr/bin/env node
/**
 * Test ProtonMail SMTP connection
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { testConnection, sendAuthCode } = require('./email-service');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  ProtonMail SMTP Connection Test      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log(`  PROTONMAIL_USER: ${process.env.PROTONMAIL_USER || '(not set)'}`);
  console.log(`  PROTONMAIL_APP_PASSWORD: ${process.env.PROTONMAIL_APP_PASSWORD ? '***' + process.env.PROTONMAIL_APP_PASSWORD.slice(-4) : '(not set)'}`);
  console.log('');
  
  // Test connection
  console.log('Testing SMTP connection...');
  const result = await testConnection();
  
  if (result.success) {
    console.log('✓ SMTP connection successful!');
    console.log('');
    console.log('Would you like to send a test email? (y/n)');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        readline.question('Enter email address: ', async (email) => {
          try {
            const testCode = '1234';
            await sendAuthCode(email, testCode, 'test-user');
            console.log('✓ Test email sent!');
          } catch (error) {
            console.error('✗ Failed to send test email:', error.message);
          }
          readline.close();
        });
      } else {
        readline.close();
      }
    });
  } else {
    console.error('✗ SMTP connection failed:', result.error);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Verify ProtonMail app password is correct');
    console.log('  2. Check that ProtonMail account has SMTP enabled');
    console.log('  3. Ensure firewall/network allows SMTP connections');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
