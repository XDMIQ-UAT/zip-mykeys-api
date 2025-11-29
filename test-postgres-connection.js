/**
 * Test Postgres Connection and Initialize Secrets Table
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { sql } = require('@vercel/postgres');

async function testConnection() {
  console.log('\n=== Testing Postgres Connection ===\n');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log(`  POSTGRES_URL: ${process.env.POSTGRES_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`  POSTGRES_URL_NON_POOLING: ${process.env.POSTGRES_URL_NON_POOLING ? '✓ Set' : '✗ Missing'}`);
  console.log('');
  
  if (!process.env.POSTGRES_URL && !process.env.POSTGRES_URL_NON_POOLING) {
    console.error('❌ POSTGRES_URL not found in environment variables');
    console.error('\nTo fix:');
    console.error('  1. Add Vercel Postgres database in Vercel dashboard');
    console.error('  2. Pull env vars: vercel env pull .env.local');
    console.error('  3. Or set POSTGRES_URL manually in .env.local');
    process.exit(1);
  }
  
  try {
    // Test basic connection
    console.log('Testing connection...');
    const result = await sql`SELECT 1 as test`;
    console.log('✓ Connection successful');
    console.log(`  Result: ${JSON.stringify(result.rows[0])}\n`);
    
    // Initialize secrets table
    console.log('Initializing secrets table...');
    await sql`
      CREATE TABLE IF NOT EXISTS secrets (
        name VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        labels JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    console.log('✓ Secrets table initialized\n');
    
    // Check if table exists and show structure
    console.log('Checking table structure...');
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position;
    `;
    
    if (tableInfo.rows.length > 0) {
      console.log('✓ Table structure:');
      tableInfo.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    }
    
    // Check existing secrets
    console.log('\nChecking existing secrets...');
    const secrets = await sql`SELECT name, created_at FROM secrets ORDER BY created_at DESC LIMIT 10`;
    
    if (secrets.rows.length > 0) {
      console.log(`✓ Found ${secrets.rows.length} secret(s):`);
      secrets.rows.forEach(secret => {
        console.log(`  - ${secret.name} (created: ${secret.created_at})`);
      });
    } else {
      console.log('  No secrets found yet');
    }
    
    console.log('\n✅ Postgres database is ready!');
    console.log('\nNext steps:');
    console.log('  1. Store SES credentials: node store-ses-credentials.js');
    console.log('  2. Deploy: vercel --prod');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('\n⚠️  Table might not exist. Trying to create...');
      try {
        await sql`
          CREATE TABLE secrets (
            name VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL,
            labels JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `;
        console.log('✓ Table created successfully');
      } catch (createError) {
        console.error('❌ Failed to create table:', createError.message);
      }
    }
    
    process.exit(1);
  }
}

testConnection().catch(console.error);



