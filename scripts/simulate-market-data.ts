#!/usr/bin/env node

import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚀 Starting market data simulation...');
console.log('📊 This will generate real trading activity to test WebSocket metrics');

// Path to the clob-dex directory
const clobDexPath = process.env.CLOB_DEX_PATH || '';

// Function to run a make command in the clob-dex directory
function runMakeCommand(target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 Running: make ${target} in ${clobDexPath}`);
    
    const childProcess = spawn('make', [target], {
      cwd: clobDexPath,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ make ${target} completed successfully`);
        resolve();
      } else {
        console.error(`❌ make ${target} failed with exit code ${code}`);
        reject(new Error(`Make command failed: ${target}`));
      }
    });

    childProcess.on('error', (error) => {
      console.error(`❌ Error running make ${target}:`, error);
      reject(error);
    });
  });
}

// Function to wait for a specified duration
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateMarketData() {
  try {
    console.log('📋 Market Data Simulation Sequence:');
    console.log('1. Fill orderbook with limit orders');
    console.log('2. Place market orders (triggers trades)');
    console.log('3. Repeat cycle multiple times');
    console.log('');

    // Check if .env file exists
    console.log('🔍 Checking environment setup...');
    
    // Run the simulation cycle multiple times
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`\n🔄 Starting simulation cycle ${cycle}/3`);
      
      // Step 1: Fill orderbook with limit orders
      console.log(`\n📝 Step 1: Filling orderbook with limit orders (cycle ${cycle})...`);
      await runMakeCommand('fill-orderbook');
      
      // Wait a bit for the indexer to process
      console.log('⏳ Waiting 5 seconds for indexer to process...');
      await wait(5000);
      
      // Step 2: Place market orders to trigger trades
      console.log(`\n💰 Step 2: Placing market orders to trigger trades (cycle ${cycle})...`);
      await runMakeCommand('market-orderbook');
      
      // Wait for processing
      console.log('⏳ Waiting 5 seconds for indexer to process...');
      await wait(5000);
      
      console.log(`✅ Cycle ${cycle} completed`);
      
      if (cycle < 3) {
        console.log('⏳ Waiting 10 seconds before next cycle...');
        await wait(10000);
      }
    }

    console.log('\n🎉 Market data simulation completed successfully!');
    console.log('📊 Check the WebSocket metrics dashboard now:');
    console.log('   npm run metrics:dashboard');
    console.log('');
    console.log('📈 The metrics should now show:');
    console.log('   - WebSocket messages sent > 0/min');
    console.log('   - Active WebSocket connections');
    console.log('   - Trade and depth update activity');
    
  } catch (error) {
    console.error('❌ Market data simulation failed:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure the blockchain network is running');
    console.log('2. Ensure contracts are deployed (run: make deploy)');
    console.log('3. Check if the indexer is running and connected');
    console.log('4. Verify .env file is properly configured');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n⏹️  Market data simulation interrupted');
  console.log('📊 Check the metrics dashboard to see any activity that was generated');
  process.exit(0);
});

// Start the simulation
simulateMarketData();