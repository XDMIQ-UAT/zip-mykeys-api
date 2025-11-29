#!/usr/bin/env node
/**
 * Interactive AWS SES Credentials Setup
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   AWS SES Credentials Setup            ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('This will help you configure AWS SES for email verification.');
  console.log('');
  
  // Get AWS credentials
  console.log('Enter your AWS credentials:');
  console.log('(You can create these in AWS IAM Console)');
  console.log('');
  
  const region = await question('AWS Region (default: us-east-1): ') || 'us-east-1';
  const accessKeyId = await question('AWS Access Key ID: ');
  const secretAccessKey = await question('AWS Secret Access Key: ');
  const senderEmail = await question('Sender Email (hello@xdmiq.com or hello@cosmiciq.com): ') || 'hello@xdmiq.com';
  
  console.log('');
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ Error: AWS credentials are required!');
    console.log('');
    console.log('Please create an IAM user with SES permissions:');
    console.log('1. Go to https://console.aws.amazon.com/iam/');
    console.log('2. Create user: mykeys-ses-sender');
    console.log('3. Attach policy: AmazonSESFullAccess');
    console.log('4. Create Access Keys');
    rl.close();
    process.exit(1);
  }
  
  // Read existing .env.local
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Remove old AWS SES config if exists
  envContent = envContent.replace(/# Amazon SES for email authentication[\s\S]*?(?=\n\n|\n#|$)/g, '');
  
  // Add new AWS SES config
  const sesConfig = `
# Amazon SES for email authentication
AWS_REGION=${region}
AWS_ACCESS_KEY_ID=${accessKeyId}
AWS_SECRET_ACCESS_KEY=${secretAccessKey}
SES_SENDER_EMAIL=${senderEmail}
`;
  
  envContent = envContent.trim() + '\n' + sesConfig;
  
  // Write back to .env.local
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ AWS SES credentials saved to .env.local');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify sender email in AWS SES Console:');
  console.log(`   https://console.aws.amazon.com/ses/home?region=${region}#/verified-identities`);
  console.log('');
  console.log(`2. Verify: ${senderEmail}`);
  console.log('');
  console.log('3. Test connection:');
  console.log('   node test-email.js');
  console.log('');
  console.log('4. Test verification flow:');
  console.log('   node test-email-verification.js');
  console.log('');
  console.log('📖 See setup-ses.md for detailed instructions');
  
  rl.close();
}

main().catch(error => {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
});
