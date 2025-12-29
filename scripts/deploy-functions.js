#!/usr/bin/env node

/**
 * Автоматический деплой всех Edge Functions
 * Использование: node scripts/deploy-functions.js [function-name]
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const projectRoot = resolve(process.cwd());
const functionsPath = resolve(projectRoot, 'supabase/functions');

console.log('🚀 Starting Edge Functions deployment...\n');

// Получаем список функций
const functions = readdirSync(functionsPath).filter(item => {
  const itemPath = join(functionsPath, item);
  return statSync(itemPath).isDirectory() && item !== '_shared';
});

// Если указано имя функции - деплоим только её
const targetFunction = process.argv[2];

if (targetFunction) {
  if (!functions.includes(targetFunction)) {
    console.error(`❌ Function '${targetFunction}' not found.`);
    console.log('\nAvailable functions:', functions.join(', '));
    process.exit(1);
  }
  
  console.log(`📦 Deploying function: ${targetFunction}`);
  try {
    execSync(`supabase functions deploy ${targetFunction} --no-verify-jwt`, {
      stdio: 'inherit',
      cwd: projectRoot
    });
    console.log(`\n✅ Function '${targetFunction}' deployed successfully!`);
  } catch (error) {
    console.error(`\n❌ Failed to deploy '${targetFunction}':`, error.message);
    process.exit(1);
  }
} else {
  // Деплоим все функции
  console.log(`📦 Found ${functions.length} functions to deploy:`);
  functions.forEach(fn => console.log(`   - ${fn}`));
  console.log('');
  
  let successCount = 0;
  let failedFunctions = [];
  
  for (const fn of functions) {
    try {
      console.log(`\n🔧 Deploying ${fn}...`);
      execSync(`supabase functions deploy ${fn} --no-verify-jwt`, {
        stdio: 'inherit',
        cwd: projectRoot
      });
      successCount++;
      console.log(`✅ ${fn} deployed`);
    } catch (error) {
      console.error(`❌ Failed to deploy ${fn}`);
      failedFunctions.push(fn);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully deployed: ${successCount}/${functions.length}`);
  if (failedFunctions.length > 0) {
    console.log(`❌ Failed functions: ${failedFunctions.join(', ')}`);
    process.exit(1);
  } else {
    console.log('🎉 All functions deployed successfully!');
  }
}
