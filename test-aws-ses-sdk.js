#!/usr/bin/env node
/**
 * Test AWS SES SDK Connection
 * Checks if AWS credentials are configured and can access SES
 */

require('dotenv').config({ path: '.env.local' });
const { SESClient, GetAccountSendingEnabledCommand, SendEmailCommand } = require('@aws-sdk/client-ses');

console.log('╔════════════════════════════════════════╗');
console.log('║   AWS SES SDK Connection Test          ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

// Check credentials
console.log('Credentials check:');
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  console.log(`  ✓ AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID}`);
  console.log(`  ✓ AWS_SECRET_ACCESS_KEY: ***${process.env.AWS_SECRET_ACCESS_KEY.slice(-4)}`);
} else {
  console.log('  ℹ No explicit credentials in .env.local');
  console.log('  ℹ Will try AWS credential chain (CLI, env vars, instance role)');
}
console.log(`  Region: ${process.env.AWS_REGION || 'us-east-1'}`);
console.log('');

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

async function testConnection() {
  console.log('Testing SES access...');
  
  try {
    const response = await sesClient.send(new GetAccountSendingEnabledCommand({}));
    console.log('✅ AWS SES SDK connection successful!');
    console.log('   Account sending enabled:', response);
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ AWS SES SDK connection failed');
    console.error('   Error:', error.message);
    console.error('');
    
    if (error.name === 'CredentialsProviderError' || error.message.includes('credentials')) {
      console.error('📋 You need to configure AWS credentials:');
      console.error('');
      console.error('Option 1: Add to .env.local (Recommended for dev)');
      console.error('  AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX');
      console.error('  AWS_SECRET_ACCESS_KEY=your_secret_key_here');
      console.error('');
      console.error('Option 2: Use AWS CLI');
      console.error('  Run: aws configure');
      console.error('');
      console.error('Option 3: Use environment variables');
      console.error('  $env:AWS_ACCESS_KEY_ID="AKIAXXXXXXXXXXXXXXXX"');
      console.error('  $env:AWS_SECRET_ACCESS_KEY="your_secret_key"');
      console.error('');
      console.error('Get credentials from AWS IAM Console:');
      console.error('  https://console.aws.amazon.com/iam/home#/users');
      console.error('  Create user → Attach policy: AmazonSESFullAccess');
      console.error('  Create access key → Copy credentials');
    }
    
    return false;
  }
}

async function testSendEmail() {
  console.log('Testing email send...');
  
  const command = new SendEmailCommand({
    Source: 'hello@xdmiq.com', // Just the email address
    Destination: {
      ToAddresses: ['bcherrman@gmail.com'],
    },
    Message: {
      Subject: {
        Data: 'Test Email from MyKeys.zip',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: 'This is a test email sent via AWS SES SDK.',
          Charset: 'UTF-8',
        },
        Html: {
          Data: '<p>This is a test email sent via <strong>AWS SES SDK</strong>.</p>',
          Charset: 'UTF-8',
        },
      },
    },
  });
  
  try {
    const response = await sesClient.send(command);
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', response.MessageId);
    console.log('');
    console.log('🎉 Everything is working! Check bcherrman@gmail.com');
    return true;
  } catch (error) {
    console.error('❌ Failed to send email');
    console.error('   Error:', error.message);
    console.error('');
    
    if (error.message.includes('not verified')) {
      console.error('   Sender email (hello@xdmiq.com) must be verified in SES');
    } else if (error.message.includes('AccessDenied') || error.message.includes('not authorized')) {
      console.error('   IAM user needs ses:SendEmail permission');
    }
    
    return false;
  }
}

async function main() {
  const connected = await testConnection();
  
  if (connected) {
    console.log('Would you like to send a test email to bcherrman@gmail.com? (y/n)');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('> ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        await testSendEmail();
      }
      readline.close();
    });
  }
}

main();
