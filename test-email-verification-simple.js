#!/usr/bin/env node
/**
 * Simple Email Verification Test (No GCP)
 */

require('dotenv').config({ path: '.env.local' });
const { sendAuthCode } = require('./email-service');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Email Verification Code Test         ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  const email = 'bcherrman@gmail.com';
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const username = 'test-user';
  
  console.log(`Sending verification code to: ${email}`);
  console.log(`Code: ${code}`);
  console.log('');
  
  try {
    const result = await sendAuthCode(email, code, username);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log('');
    console.log('🎉 Check your email for the verification code!');
    console.log(`   The code is: ${code}`);
  } catch (error) {
    console.error('❌ Failed to send email');
    console.error('   Error:', error.message);
  }
}

main();
