#!/usr/bin/env node
/**
 * Get and filter Vercel logs - Simple version
 */

const { execSync } = require('child_process');

const deploymentUrl = process.argv[2] || 'zip-myl-mykeys-p0lwdwrkw-xdmiq.vercel.app';

console.log('\n=== Checking Redis Initialization ===\n');

try {
  // Trigger a request to generate logs
  const https = require('https');
  https.get('https://mykeys.zip/api/auth/request-mfa-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, () => {}).on('error', () => {});
  
  // Wait a moment
  setTimeout(() => {
    try {
      const logs = execSync(`vercel logs ${deploymentUrl} --json 2>&1`, { 
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 1024 * 1024 * 10
      });
      
      const lines = logs.split('\n').filter(l => l.trim());
      const redisLogs = lines
        .map(l => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(l => l && (
          l.message?.includes('Redis') ||
          l.message?.includes('UPSTASH') ||
          l.message?.includes('initialized') ||
          l.message?.includes('configured') ||
          l.message?.includes('SES')
        ));
      
      if (redisLogs.length > 0) {
        console.log('Found Redis-related logs:');
        redisLogs.forEach(log => {
          console.log(`  [${log.level || 'info'}] ${log.message}`);
        });
      } else {
        console.log('No Redis initialization logs found.');
        console.log('This might mean:');
        console.log('  - Environment variables not available at startup');
        console.log('  - Redis client not initializing');
        console.log('  - Logs not captured yet');
      }
    } catch (error) {
      console.error('Could not fetch logs:', error.message);
      console.log('\nAlternative: Check Vercel dashboard');
      console.log('  https://vercel.com/xdmiq/zip-myl-mykeys-api');
    }
    
    console.log('\n');
  }, 2000);
  
} catch (error) {
  console.error('Error:', error.message);
}




