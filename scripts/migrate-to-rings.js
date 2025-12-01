#!/usr/bin/env node
/**
 * Migration script to convert legacy global roles to ring-based structure
 * 
 * Usage: node scripts/migrate-to-rings.js [ringId]
 * 
 * If ringId is not provided, defaults to 'default'
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { getKV } = require('../server');
const { createRing, initializeDefaultRing, FIRST_EMAIL } = require('../ring-management');
const { getAllUserRoles } = require('../role-management');

async function migrateToRings(ringId = 'default') {
  console.log('🔄 Starting migration to ring-based role system...\n');
  
  try {
    const kv = getKV();
    if (!kv) {
      throw new Error('KV storage not available');
    }
    
    // Check if rings already exist
    const ringsData = await kv.get('rings');
    if (ringsData) {
      const rings = JSON.parse(ringsData);
      if (rings[ringId]) {
        console.log(`⚠️  Ring '${ringId}' already exists. Skipping migration.`);
        console.log('   If you want to migrate anyway, delete the ring first or use a different ringId.\n');
        return;
      }
    }
    
    // Get legacy roles
    console.log('📖 Reading legacy role data...');
    const legacyRoles = await getAllUserRoles();
    
    if (!legacyRoles || Object.keys(legacyRoles).length === 0) {
      console.log('ℹ️  No legacy roles found. Creating default ring with first email...');
      const ring = await initializeDefaultRing();
      console.log(`✅ Created default ring: ${ring.id}`);
      console.log(`   First email: ${ring.firstEmail}`);
      console.log(`   Members: ${Object.keys(ring.members).join(', ')}\n`);
      return;
    }
    
    console.log(`   Found ${Object.keys(legacyRoles).length} users with roles\n`);
    
    // Determine first email
    let firstEmail = FIRST_EMAIL;
    if (!legacyRoles[firstEmail]) {
      // Use first email in legacy roles if first email not found
      firstEmail = Object.keys(legacyRoles)[0];
      console.log(`⚠️  First email (${FIRST_EMAIL}) not found in legacy roles.`);
      console.log(`   Using first email from legacy data: ${firstEmail}\n`);
    }
    
    // Create ring with legacy roles
    console.log(`🏗️  Creating ring '${ringId}' with first email: ${firstEmail}...`);
    const ring = await createRing(ringId, firstEmail, legacyRoles);
    
    console.log(`✅ Migration completed successfully!\n`);
    console.log(`📊 Ring Summary:`);
    console.log(`   Ring ID: ${ring.id}`);
    console.log(`   First Email: ${ring.firstEmail}`);
    console.log(`   Created: ${ring.createdAt}`);
    console.log(`   Members: ${Object.keys(ring.members).length}`);
    console.log(`\n👥 Members:`);
    
    for (const [email, memberData] of Object.entries(ring.members)) {
      const roles = memberData.roles.join(', ');
      const marker = email === ring.firstEmail ? ' (first email)' : '';
      console.log(`   - ${email}: [${roles}]${marker}`);
    }
    
    console.log(`\n💡 Note: Legacy role data is preserved in KV storage.`);
    console.log(`   You can safely delete it after verifying the migration.\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
const ringId = process.argv[2] || 'default';
migrateToRings(ringId)
  .then(() => {
    console.log('✨ Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });



