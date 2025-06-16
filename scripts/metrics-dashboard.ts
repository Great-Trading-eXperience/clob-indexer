#!/usr/bin/env node

console.log('Script starting...');

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

// Use CommonJS-style __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Imports complete, setting up constants...');

// Define the SystemMetrics interface first
interface SystemMetrics {
  timestamp: string;
  uptime?: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  systemMemory?: {
    total: number;
    free: number;
    used: number;
    percentUsed: number;
  };
  cpu?: {
    usage: number;
    cores: number;
    loadAvg?: number[];
  };
  disk?: {
    used: number;
    total: number;
    free: number;
    usagePercent: number;
  };
  network?: {
    connections: number;
    totalReceived: number;
    totalSent: number;
  };
  database?: {
    sizeMB: number;
    sizeBytes: number;
    tables?: Record<string, number>;
  };
  records?: {
    pools: number;
    orders: number;
    trades: number;
    depth: number;
    balances: number;
  };
  logs?: {
    totalSizeBytes: number;
    files: Record<string, number>;
  };
  websocket?: {
    connections?: number;
    messages?: number;
    errors?: number;
    activeConnections?: number;
    totalSubscriptions?: number;
    userConnections?: number;
    publicConnections?: number;
    messagesSentLastMinute?: number;
    messagesReceivedLastMinute?: number;
    subscriptionTypes?: Record<string, number>;
  };
}

// Create a dashboard state object to avoid variable hoisting issues
const dashboardState = {
  lastUpdateSource: 'auto',
  lastUpdateTime: Date.now(),
  cachedCurrentMetrics: null as SystemMetrics | null,
  cachedPreviousMetrics: null as SystemMetrics | null,
  REFRESH_INTERVAL_MS: 5000, // 5 seconds
  autoRefresh: true
};

console.log('Dashboard state created...');

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m",
  white: "\x1b[37m"
};

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatTrend(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return `${colors.dim}=${colors.reset}`;
  return diff > 0 
    ? `${colors.green}▲ ${diff.toFixed(2)}${colors.reset}` 
    : `${colors.red}▼ ${Math.abs(diff).toFixed(2)}${colors.reset}`;
}

function formatTrendBytes(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return `${colors.dim}=${colors.reset}`;
  return diff > 0 
    ? `${colors.green}▲ ${formatBytes(diff)}${colors.reset}` 
    : `${colors.red}▼ ${formatBytes(Math.abs(diff))}${colors.reset}`;
}

function formatTrendCount(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return `${colors.dim}=${colors.reset}`;
  return diff > 0 
    ? `${colors.green}▲ ${diff}${colors.reset}` 
    : `${colors.red}▼ ${Math.abs(diff)}${colors.reset}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function drawProgressBar(value: number, max: number, width: number = 20): string {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;
  
  let color = colors.green;
  if (percentage > 70) color = colors.yellow;
  if (percentage > 90) color = colors.red;
  
  return `${color}${'█'.repeat(filledWidth)}${colors.dim}${'░'.repeat(emptyWidth)}${colors.reset} ${percentage.toFixed(1)}%`;
}

// Clear the terminal screen
function clearScreen(): void {
  const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
  
  if (isTTY) {
    // Use multiple methods to ensure screen clearing works across different terminals
    console.clear(); // Node.js built-in clear
    process.stdout.write('\x1Bc'); // ANSI escape sequence
    console.log('\n'.repeat(process.stdout.rows || 40)); // Fallback method
  } else {
    // In non-TTY mode, just add some separator lines
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Format date to local time string
function formatDateTime(timestamp: string | undefined): string {
  if (!timestamp) {
    return new Date().toLocaleString();
  }
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Function to collect fresh metrics directly from system and database
async function collectFreshMetrics(): Promise<SystemMetrics> {
  console.log('collectFreshMetrics called...');
  const metrics: SystemMetrics = {
    timestamp: new Date().toISOString(),
    memory: {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0
    },
    systemMemory: {
      total: 0,
      free: 0,
      used: 0,
      percentUsed: 0
    },
    database: {
      sizeBytes: 0,
      sizeMB: 0,
      tables: {
        pools: 0,
        orders: 0,
        orderBookTrades: 0,
        orderBookDepth: 0,
        balances: 0
      }
    },
    records: {
      pools: 0,
      orders: 0,
      trades: 0,
      depth: 0,
      balances: 0
    },
    websocket: {
      activeConnections: 0,
      totalSubscriptions: 0,
      userConnections: 0,
      publicConnections: 0,
      messagesSentLastMinute: 0,
      messagesReceivedLastMinute: 0,
      subscriptionTypes: {
        market: 0,
        user: 0,
        other: 0
      }
    },
    uptime: 0
  };
  
  try {
    // Get memory usage - this will always work even if other metrics aren't available
    const memoryUsage = process.memoryUsage();
    metrics.memory = {
      rss: memoryUsage.rss / (1024 * 1024),
      heapTotal: memoryUsage.heapTotal / (1024 * 1024),
      heapUsed: memoryUsage.heapUsed / (1024 * 1024),
      external: memoryUsage.external / (1024 * 1024)
    };
    
    // Get system memory information
    const totalMem = os.totalmem() / (1024 * 1024 * 1024); // Convert to GB
    const freeMem = os.freemem() / (1024 * 1024 * 1024); // Convert to GB
    const usedMem = totalMem - freeMem;
    const percentUsed = (usedMem / totalMem) * 100;
    
    metrics.systemMemory = {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentUsed: percentUsed
    };
  
    // Get database size using psql
    const dbUrl = process.env.PONDER_DATABASE_URL;
    if (dbUrl) {
      try {
        const dbName = dbUrl.split('/').pop() || 'postgres';
        const sizeQuery = `SELECT pg_database_size('${dbName}') as size;`;
        const sizeResult = execSync(`psql "${dbUrl}" -t -c "${sizeQuery}"`).toString().trim();
        const sizeBytes = parseInt(sizeResult, 10);
        metrics.database = {
          sizeBytes,
          sizeMB: sizeBytes / (1024 * 1024),
          tables: metrics.database?.tables || {
            pools: 0,
            orders: 0,
            orderBookTrades: 0,
            orderBookDepth: 0,
            balances: 0
          }
        };
        
        // Get record counts
        const countQueries = {
          pools: 'SELECT COUNT(*) FROM pools',
          orders: 'SELECT COUNT(*) FROM orders',
          trades: 'SELECT COUNT(*) FROM trades',
          depthLevels: 'SELECT COUNT(*) FROM depth_levels',
          balances: 'SELECT COUNT(*) FROM balances'
        };
        
        const counts: Record<string, number> = {};
        for (const [table, query] of Object.entries(countQueries)) {
          try {
            const result = execSync(`psql "${dbUrl}" -t -c "${query}"`).toString().trim();
            counts[table] = parseInt(result, 10) || 0;
          } catch (e) {
            console.error(`Error getting count for ${table}:`, e);
            counts[table] = 0;
          }
        }
        
        metrics.records = {
          pools: counts.pools || 0,
          orders: counts.orders || 0,
          trades: counts.trades || 0,
          depth: counts.depthLevels || 0,
          balances: counts.balances || 0
        };
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        // Continue with other metrics even if database is unavailable
      }
    }
    
    // Get WebSocket stats from the latest log entry
    // We can't easily get this directly, so we'll read from the log file
    const logFile = path.join(__dirname, '..', 'logs', 'system-metrics.log');
    if (fs.existsSync(logFile)) {
      try {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter((line: string) => !!line && line.trim() !== '');
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          if (lastLine) {
            const lastMetrics = JSON.parse(lastLine);
            if (lastMetrics && lastMetrics.websocket) {
              metrics.websocket = {
                ...lastMetrics.websocket,
                subscriptionTypes: lastMetrics.websocket.subscriptionTypes || {
                  market: 0,
                  user: 0,
                  other: 0
                }
              };
            }
          }
        }
      } catch (error) {
        console.error('Error reading WebSocket stats from log:', error);
      }
    }
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Save the fresh metrics to the log file
    const historyLogFile = path.join(__dirname, '..', 'logs', 'metrics-history.log');
    fs.appendFileSync(historyLogFile, JSON.stringify(metrics) + '\n');
    
    // Also update the system metrics log file to ensure it exists for future reads
    const systemLogFile = path.join(__dirname, '..', 'logs', 'system-metrics.log');
    if (!fs.existsSync(systemLogFile) || fs.readFileSync(systemLogFile, 'utf8').trim() === '') {
      fs.writeFileSync(systemLogFile, JSON.stringify(metrics) + '\n');
    }
    
      // Update uptime to current value
    metrics.uptime = Math.floor(process.uptime() / 60); // Minutes
    
    return metrics;
  } catch (error) {
    console.error('Error collecting fresh metrics:', error);
    return metrics; // Return default metrics on error
  }
}

// Save metrics to history log
function saveMetricsHistory(metrics: SystemMetrics): void {
  const historyLogFile = path.join(__dirname, '..', 'logs', 'metrics-history.log');
  const logDir = path.dirname(historyLogFile);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logEntry = JSON.stringify(metrics) + '\n';
  fs.appendFileSync(historyLogFile, logEntry);
}

// Main dashboard function
async function showDashboard(forceRefresh: boolean = false): Promise<void> {
  // Get metrics
  const logFile = path.join(__dirname, '..', 'logs', 'system-metrics.log');
  let previousMetrics: SystemMetrics | null = null;
  let currentMetrics: SystemMetrics | null = null;
  
  try {
    // If manual refresh is requested or it's the first run
    if (forceRefresh) {
      // Update the source tracking
      dashboardState.lastUpdateSource = 'manual';
      dashboardState.lastUpdateTime = Date.now();
      
      // Get fresh metrics directly from system
      currentMetrics = await collectFreshMetrics();
      
      // Save fresh metrics to history log
      if (currentMetrics) {
        const historyLogFile = path.join(__dirname, '..', 'logs', 'metrics-history.log');
        fs.appendFileSync(historyLogFile, JSON.stringify(currentMetrics) + '\n');
        
        // Store in cache to prevent auto-refresh from overwriting
        dashboardState.cachedCurrentMetrics = currentMetrics;
      }
      
      // Get previous metrics from log file for comparison
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter((line: string) => !!line && line.trim() !== '');
        
        if (lines.length >= 2) {
          const previousLine = lines[lines.length - 2];
          if (previousLine) {
            try {
              previousMetrics = JSON.parse(previousLine);
              dashboardState.cachedPreviousMetrics = previousMetrics;
            } catch (e) {
              console.error('Error parsing previous metrics:', e);
            }
          }
        }
      }
    } 
    // Auto-refresh mode - only update from log file if we're not in manual mode
    // or if it's been more than one refresh interval since manual refresh
    else if (dashboardState.lastUpdateSource === 'auto' || 
             (Date.now() - dashboardState.lastUpdateTime) > dashboardState.REFRESH_INTERVAL_MS * 2) {
      
      // Update source tracking
      dashboardState.lastUpdateSource = 'auto';
      dashboardState.lastUpdateTime = Date.now();
      
      // Read from log file
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter((line: string) => !!line && line.trim() !== '');
        
        if (lines.length >= 2) {
          const currentLine = lines[lines.length - 1];
          const previousLine = lines[lines.length - 2];
          if (currentLine && previousLine) {
            try {
              currentMetrics = JSON.parse(currentLine);
              previousMetrics = JSON.parse(previousLine);
              
              // Update cache
              dashboardState.cachedCurrentMetrics = currentMetrics;
              dashboardState.cachedPreviousMetrics = previousMetrics;
            } catch (e) {
              console.error('Error parsing metrics:', e);
            }
          }
        } else if (lines.length === 1) {
          const line = lines[0];
          if (line) {
            try {
              currentMetrics = JSON.parse(line);
              dashboardState.cachedCurrentMetrics = currentMetrics;
            } catch (e) {
              console.error('Error parsing metrics:', e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading metrics log:', error);
    return;
  }
  
  if (!currentMetrics) {
    console.log('No metrics data available. Please start the metrics collector first.');
    return;
  }
  
  // Save to history log
  saveMetricsHistory(currentMetrics);
  
  // Clear screen
  clearScreen();
  
  // Draw header
  const now = new Date();
  const header = `${colors.bright}${colors.bgBlue}${colors.white} GTX Indexer Metrics Dashboard ${colors.reset} ${now.toLocaleString()}`;
  const uptimeStr = `Uptime: ${formatUptime(currentMetrics.uptime || 0)}`;
  
  console.log(header + ' '.repeat(20) + uptimeStr);
  console.log('═'.repeat(80));
  
  // System resources section
  console.log(`${colors.bright}${colors.cyan}System Resources${colors.reset}`);
  
  // System Memory
  // Always collect fresh system memory data for display
  const totalMem = os.totalmem() / (1024 * 1024 * 1024); // Convert to GB
  const freeMem = os.freemem() / (1024 * 1024 * 1024); // Convert to GB
  const usedMem = totalMem - freeMem;
  const percentUsed = (usedMem / totalMem) * 100;
  
  const systemMemoryPercentBar = drawProgressBar(usedMem, totalMem);
  console.log(`${colors.yellow}🖥️  System Memory:  ${colors.reset}${systemMemoryPercentBar} ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB (${percentUsed.toFixed(1)}%)`);
  console.log(`${colors.dim}              Free: ${freeMem.toFixed(2)} GB${colors.reset}`);
  
  // Process Memory
  console.log(`${colors.yellow}⚙️  Process Memory:  ${colors.reset}${drawProgressBar(currentMetrics.memory.heapUsed, currentMetrics.memory.heapTotal)} ${currentMetrics.memory.heapUsed.toFixed(2)} / ${currentMetrics.memory.heapTotal.toFixed(2)} MB`);
  
  if (previousMetrics) {
    console.log(`${colors.dim}              RSS: ${currentMetrics.memory.rss.toFixed(2)} MB ${formatTrend(currentMetrics.memory.rss, previousMetrics.memory.rss)}${colors.reset}`);
    console.log(`${colors.dim}              External: ${currentMetrics.memory.external.toFixed(2)} MB ${formatTrend(currentMetrics.memory.external, previousMetrics.memory.external)}${colors.reset}`);
  } else {
    console.log(`${colors.dim}              RSS: ${currentMetrics.memory.rss.toFixed(2)} MB${colors.reset}`);
    console.log(`${colors.dim}              External: ${currentMetrics.memory.external.toFixed(2)} MB${colors.reset}`);
  }
  
  // CPU Usage
  if (currentMetrics.cpu) {
    const cpuBar = drawProgressBar(currentMetrics.cpu.usage, 100);
    console.log(`${colors.yellow}🧠 CPU Usage:     ${colors.reset}${cpuBar} ${currentMetrics.cpu.usage.toFixed(1)}% (${currentMetrics.cpu.cores} cores)`);
    if (currentMetrics.cpu.loadAvg && Array.isArray(currentMetrics.cpu.loadAvg) && currentMetrics.cpu.loadAvg.length >= 3) {
      const oneMin = currentMetrics.cpu.loadAvg[0] || 0;
      const fiveMin = currentMetrics.cpu.loadAvg[1] || 0;
      const fifteenMin = currentMetrics.cpu.loadAvg[2] || 0;
      console.log(`${colors.dim}              Load Avg: ${oneMin.toFixed(2)}, ${fiveMin.toFixed(2)}, ${fifteenMin.toFixed(2)} (1m, 5m, 15m)${colors.reset}`);
    }
  }

  // Disk Usage
  if (currentMetrics.disk && typeof currentMetrics.disk.used === 'number' && 
      typeof currentMetrics.disk.total === 'number' && 
      typeof currentMetrics.disk.free === 'number' && 
      typeof currentMetrics.disk.usagePercent === 'number') {
    const diskBar = drawProgressBar(currentMetrics.disk.used, currentMetrics.disk.total);
    const usedGB = currentMetrics.disk.used / (1024 * 1024 * 1024);
    const totalGB = currentMetrics.disk.total / (1024 * 1024 * 1024);
    const freeGB = currentMetrics.disk.free / (1024 * 1024 * 1024);
    console.log(`${colors.yellow}💾 Disk Usage:    ${colors.reset}${diskBar} ${usedGB.toFixed(2)} / ${totalGB.toFixed(2)} GB (${currentMetrics.disk.usagePercent.toFixed(1)}%)`);
    console.log(`${colors.dim}              Free: ${freeGB.toFixed(2)} GB${colors.reset}`);
  }

  // Log Files
  if (currentMetrics.logs && 
      typeof currentMetrics.logs.totalSizeBytes === 'number' && 
      currentMetrics.logs.files) {
    const totalSizeMB = currentMetrics.logs.totalSizeBytes / (1024 * 1024);
    const fileCount = Object.keys(currentMetrics.logs.files).length;
    console.log(`${colors.yellow}📄 Log Files:     ${colors.reset}${fileCount} files, ${totalSizeMB.toFixed(2)} MB total`);
    
    // Display up to 3 largest log files
    const sortedFiles = Object.entries(currentMetrics.logs.files)
      .sort(([, sizeA], [, sizeB]) => (Number(sizeB) - Number(sizeA)))
      .slice(0, 3);
    
    for (const [filename, size] of sortedFiles) {
      const sizeMB = Number(size) / (1024 * 1024);
      console.log(`${colors.dim}              ${filename}: ${sizeMB.toFixed(2)} MB${colors.reset}`);
    }
  }

  // Network
  if (currentMetrics.network && 
      typeof currentMetrics.network.connections === 'number' && 
      typeof currentMetrics.network.totalReceived === 'number' && 
      typeof currentMetrics.network.totalSent === 'number') {
    console.log(`${colors.yellow}🌐 Network:       ${colors.reset}${currentMetrics.network.connections} active connections`);
    if (previousMetrics && previousMetrics.network && 
        typeof previousMetrics.network.totalReceived === 'number' && 
        typeof previousMetrics.network.totalSent === 'number') {
      const rxDiff = currentMetrics.network.totalReceived - previousMetrics.network.totalReceived;
      const txDiff = currentMetrics.network.totalSent - previousMetrics.network.totalSent;
      console.log(`${colors.dim}              Packets Received: ${formatNumber(currentMetrics.network.totalReceived)} (${formatTrend(rxDiff, 0)} since last check)${colors.reset}`);
      console.log(`${colors.dim}              Packets Sent: ${formatNumber(currentMetrics.network.totalSent)} (${formatTrend(txDiff, 0)} since last check)${colors.reset}`);
    } else {
      console.log(`${colors.dim}              Packets Received: ${formatNumber(currentMetrics.network.totalReceived)}${colors.reset}`);
      console.log(`${colors.dim}              Packets Sent: ${formatNumber(currentMetrics.network.totalSent)}${colors.reset}`);
    }
  }

  // Database
  if (currentMetrics.database && typeof currentMetrics.database.sizeMB === 'number') {
    console.log(`${colors.yellow}🗄️  Database Size: ${colors.reset}${currentMetrics.database.sizeMB.toFixed(2)} MB`);
    if (previousMetrics && previousMetrics.database && typeof previousMetrics.database.sizeBytes === 'number') {
      console.log(`${colors.dim}              ${formatTrendBytes(currentMetrics.database.sizeBytes, previousMetrics.database.sizeBytes)} since last check${colors.reset}`);
    }
  }
  
  console.log('─'.repeat(80));
  
  // Record counts section
  console.log(`${colors.bright}${colors.cyan}Record Counts${colors.reset}`);
  
  if (currentMetrics.records) {
    const recordTypes = [
      { name: 'Pools', value: currentMetrics.records.pools },
      { name: 'Orders', value: currentMetrics.records.orders },
      { name: 'Trades', value: currentMetrics.records.trades },
      { name: 'Depth Levels', value: currentMetrics.records.depth },
      { name: 'Balances', value: currentMetrics.records.balances }
    ];
    
    const maxRecords = Math.max(...recordTypes.map(r => r.value));
    
    recordTypes.forEach(record => {
      const barWidth = 30;
      const filledWidth = maxRecords > 0 ? Math.max(1, Math.round((record.value / maxRecords) * barWidth)) : 0;
      const bar = '█'.repeat(filledWidth) + ' '.repeat(barWidth - filledWidth);
      
      let trend = '';
      if (previousMetrics && previousMetrics.records) {
        const prevValue = previousMetrics.records[record.name.toLowerCase() as keyof typeof previousMetrics.records];
        if (typeof prevValue === 'number') {
        trend = formatTrendCount(record.value, prevValue);
      }
    }
    
    console.log(`${colors.yellow}${record.name.padEnd(12)}${colors.reset} ${record.value.toString().padStart(5)} ${colors.blue}${bar}${colors.reset} ${trend}`);
  });
  
  console.log('─'.repeat(80));
  
  // WebSocket stats
  if (currentMetrics.websocket) {
    console.log(`${colors.bright}${colors.cyan}WebSocket Stats${colors.reset}`);
    
    // Handle active connections
    const activeConnections = currentMetrics.websocket.activeConnections || 0;
    console.log(`${colors.yellow}🔌 Connections:   ${colors.reset}${activeConnections} active connections`);
    
    // Handle user and public connections
    const userConnections = currentMetrics.websocket.userConnections || 0;
    const publicConnections = currentMetrics.websocket.publicConnections || 0;
    console.log(`${colors.dim}              ${userConnections} user, ${publicConnections} public${colors.reset}`);
    
    // Handle total subscriptions
    const totalSubscriptions = currentMetrics.websocket.totalSubscriptions || 0;
    console.log(`${colors.dim}              ${totalSubscriptions} subscriptions${colors.reset}`);
    
    // Display subscription types
    if (currentMetrics.websocket.subscriptionTypes) {
      const subscriptionTypes = currentMetrics.websocket.subscriptionTypes;
      const sortedTypes = Object.entries(subscriptionTypes)
        .sort(([, countA], [, countB]) => countB - countA);
      
      for (const [type, count] of sortedTypes.slice(0, 3)) {
        console.log(`${colors.dim}              ${type}: ${count}${colors.reset}`);
      }
    }
    
    // Message rates
    const messagesSent = currentMetrics.websocket.messagesSentLastMinute || 0;
    const messagesReceived = currentMetrics.websocket.messagesReceivedLastMinute || 0;
    
    console.log(`${colors.yellow}📨 Messages:      ${colors.reset}${drawProgressBar(messagesSent, 1000)} ${messagesSent}/min sent`);
    console.log(`${colors.dim}              ${messagesReceived}/min received${colors.reset}`);
    
    if (previousMetrics && previousMetrics.websocket) {
      const prevMessagesSent = previousMetrics.websocket.messagesSentLastMinute || 0;
      const prevMessagesReceived = previousMetrics.websocket.messagesReceivedLastMinute || 0;
      
      console.log(`${colors.dim}              Sent: ${formatTrendCount(messagesSent, prevMessagesSent)} since last check${colors.reset}`);
      console.log(`${colors.dim}              Received: ${formatTrendCount(messagesReceived, prevMessagesReceived)} since last check${colors.reset}`);
    }
  } else {
    console.log(`${colors.dim}No WebSocket data available${colors.reset}`);
  }
  
  console.log('═'.repeat(80));
  console.log(`${colors.dim}Historical data saved to metrics-history.log${colors.reset}`);
  
  // Display last updated timestamp
  if (currentMetrics && currentMetrics.timestamp) {
    console.log(`${colors.dim}Last updated: ${formatDateTime(currentMetrics.timestamp)}${colors.reset}`);
  }
}

// Display help information
function displayHelp(): void {
  const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
  if (isTTY) {
    console.log(`${colors.dim}${dashboardState.autoRefresh ? `Auto-refreshing every ${dashboardState.REFRESH_INTERVAL_MS/1000} seconds.` : 'Auto-refresh is OFF.'} Press:${colors.reset}`);
    console.log(`${colors.yellow}r${colors.reset} - Refresh metrics now`);
    console.log(`${colors.yellow}a${colors.reset} - Toggle auto-refresh`);
    console.log(`${colors.yellow}c${colors.reset} - Clear screen`);
    console.log(`${colors.yellow}h${colors.reset} - Show this help`);
    console.log(`${colors.yellow}q${colors.reset} - Quit`);
  } else {
    console.log(`${colors.dim}Non-interactive mode: Auto-refreshing every ${dashboardState.REFRESH_INTERVAL_MS/1000} seconds. Press Ctrl+C to quit.${colors.reset}`);
  }
}

console.log('Setting up keyboard input...');

// Setup for handling keyboard input
// Check if we have a TTY (interactive terminal)
const isTTY = Boolean(process.stdin.isTTY || process.stdout.isTTY);
console.log(`Terminal mode: ${isTTY ? 'Interactive TTY' : 'Non-interactive'}`);

if (isTTY && process.stdin.setRawMode) {
  console.log('Setting up raw mode...');
  // Enable raw mode for immediate key detection
  process.stdin.setRawMode(true);
  readline.emitKeypressEvents(process.stdin);
  console.log('Raw mode setup complete');
  
  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    
    if (key.ctrl && key.name === 'c') {
      // Exit on Ctrl+C
      console.log('\nDashboard closed');
      process.exit(0);
    } else if (key.name === 'r' || key.name === 'R') {
      // Manual refresh on 'r' key press (case insensitive) with fresh metrics
      clearScreen();
      showDashboard(true) // Pass true to force refresh
        .then(() => {
          displayHelp();
          console.log(`${colors.green}Manual refresh with fresh metrics triggered at ${new Date().toLocaleString()}!${colors.reset}`);
        })
        .catch(err => console.error('Error during manual refresh:', err));
    } else if (key.name === 'a' || key.name === 'A') {
      // Toggle auto-refresh on 'a' key press (case insensitive)
      dashboardState.autoRefresh = !dashboardState.autoRefresh;
      
      // When toggling auto-refresh off, get fresh metrics
      if (!dashboardState.autoRefresh) {
        // Force a manual refresh when auto-refresh is disabled
        clearScreen();
        showDashboard(true)
          .then(() => displayHelp())
          .catch(err => console.error('Error during manual refresh:', err));
        return;
      }
      
      clearScreen();
      showDashboard()
        .then(() => {
          displayHelp();
          console.log(`${colors.yellow}Auto-refresh ${dashboardState.autoRefresh ? 'enabled' : 'disabled'}!${colors.reset}`);
        })
        .catch(err => console.error('Error during auto-refresh toggle:', err));
    }
  });
} else {
  // In non-interactive mode, still handle Ctrl+C for clean exit
  console.log('Setting up non-interactive mode...');
}

// Handle clean exit
process.on('SIGINT', () => {
  console.log('\nDashboard closed');
  // Clear the interval before exiting
  if (typeof intervalId !== 'undefined') {
    clearInterval(intervalId);
  }
  process.exit(0);
});

// Initial dashboard display
console.log('Starting dashboard...');
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Working directory: ${process.cwd()}`);

// Ensure logs directory exists
console.log('Setting up logs directory...');
const logsDir = path.join(process.cwd(), 'logs');
console.log(`Logs directory: ${logsDir}`);
if (!fs.existsSync(logsDir)) {
  console.log(`Creating logs directory at ${logsDir}`);
  fs.mkdirSync(logsDir, { recursive: true });
} else {
  console.log('Logs directory exists');
}

// Check if log file exists
const logFilePath = path.join(logsDir, 'system-metrics.log');
if (!fs.existsSync(logFilePath)) {
  console.log(`Log file not found at ${logFilePath}`);
  console.log('Creating an empty log file for demonstration...');
  
  // Create an empty metrics file with sample data for demonstration
  const sampleMetric = {
    timestamp: new Date().toISOString(),
    cpu: { usage: 10.5 },
    memory: { free: 1024 * 1024 * 1024, total: 8 * 1024 * 1024 * 1024 },
    disk: { free: 100 * 1024 * 1024 * 1024, total: 500 * 1024 * 1024 * 1024 },
    network: { rx: 1024, tx: 2048 },
    database: { size: 1024 * 1024, tables: { pools: 10, orders: 100, trades: 50 } },
    websocket: { connections: 5, subscriptions: 10 },
    logs: { sizes: { 'app.log': 1024, 'error.log': 512 } }
  };
  
  fs.writeFileSync(logFilePath, JSON.stringify(sampleMetric) + '\n');
  console.log('Sample metrics data created for demonstration');
}

console.log('About to start main execution...');

try {
  clearScreen();
  console.log('Screen cleared, loading metrics...');
  
  // Start with fresh metrics
  showDashboard(true)
    .then(() => {
      console.log('Dashboard loaded successfully');
      displayHelp();
    })
    .catch(err => {
      console.error('Error in initial dashboard display:', err);
      console.log('Try running the system monitor first with: pnpm monitor');
    });
} catch (error) {
  console.error('Critical error in dashboard initialization:', error);
}

// Force console output to be displayed immediately
// Note: Don't force TTY mode as it can cause issues in non-interactive environments

// Set up the refresh interval
const intervalId = setInterval(() => {
  if (dashboardState.autoRefresh) {
    clearScreen();
    console.log('Refreshing dashboard...'); // Debug output
    // Don't force refresh, let the function decide based on timing
    showDashboard(false)
      .then(() => {
        console.log('Auto-refresh complete');
        displayHelp();
      })
      .catch(err => console.error('Error in auto-refresh dashboard display:', err));
  }
}, dashboardState.REFRESH_INTERVAL_MS);
}
