#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function drawProgressBar(value: number, max: number, width: number = 20): string {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;
  
  let color = colors.green;
  if (percentage > 70) color = colors.yellow;
  if (percentage > 90) color = colors.red;
  
  return `${color}${'█'.repeat(filledWidth)}${colors.dim}${'░'.repeat(emptyWidth)}${colors.reset} ${percentage.toFixed(1)}%`;
}

// Clear screen
function clearScreen(): void {
  console.clear();
  process.stdout.write('\x1B[0f');
}

interface SystemMetrics {
  timestamp: string;
  database: {
    sizeBytes: number;
    sizeMB: number;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  records: {
    pools: number;
    orders: number;
    trades: number;
    depth: number;
    balances: number;
  };
  websocket?: {
    activeConnections: number;
    totalSubscriptions: number;
    userConnections: number;
    publicConnections: number;
    messagesSentLastMinute: number;
    messagesReceivedLastMinute: number;
  };
  uptime: number;
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
function showDashboard(): void {
  // Get metrics
  const logFile = path.join(__dirname, '..', 'logs', 'system-metrics.log');
  let previousMetrics: SystemMetrics | null = null;
  let currentMetrics: SystemMetrics | null = null;
  
  try {
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length >= 2) {
        const currentLine = lines[lines.length - 1];
        const previousLine = lines[lines.length - 2];
        if (currentLine && previousLine) {
          currentMetrics = JSON.parse(currentLine);
          previousMetrics = JSON.parse(previousLine);
        }
      } else if (lines.length === 1) {
        const line = lines[0];
        if (line) {
          currentMetrics = JSON.parse(line);  
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
  const header = `${colors.bright}${colors.bgBlue}${colors.white} CLOB Indexer Metrics Dashboard ${colors.reset} ${now.toLocaleString()}`;
  const uptimeStr = `Uptime: ${formatUptime(currentMetrics.uptime)}`;
  
  console.log(header + ' '.repeat(20) + uptimeStr);
  console.log('═'.repeat(80));
  
  // System resources section
  console.log(`${colors.bright}${colors.cyan}System Resources${colors.reset}`);
  
  // Memory
  console.log(`${colors.yellow}Memory Usage:  ${colors.reset}${drawProgressBar(currentMetrics.memory.heapUsed, currentMetrics.memory.heapTotal)} ${(currentMetrics.memory.heapUsed / (1024 * 1024)).toFixed(2)} / ${(currentMetrics.memory.heapTotal / (1024 * 1024)).toFixed(2)} MB`);
  
  if (previousMetrics) {
    console.log(`${colors.dim}              RSS: ${(currentMetrics.memory.rss / (1024 * 1024)).toFixed(2)} MB ${formatTrend(currentMetrics.memory.rss, previousMetrics.memory.rss)}${colors.reset}`);
    console.log(`${colors.dim}              External: ${(currentMetrics.memory.external / (1024 * 1024)).toFixed(2)} MB ${formatTrend(currentMetrics.memory.external, previousMetrics.memory.external)}${colors.reset}`);
  } else {
    console.log(`${colors.dim}              RSS: ${(currentMetrics.memory.rss / (1024 * 1024)).toFixed(2)} MB${colors.reset}`);
    console.log(`${colors.dim}              External: ${(currentMetrics.memory.external / (1024 * 1024)).toFixed(2)} MB${colors.reset}`);
  }
  
  // Database
  console.log(`${colors.yellow}Database Size: ${colors.reset}${currentMetrics.database.sizeMB.toFixed(2)} MB`);
  if (previousMetrics) {
    console.log(`${colors.dim}              ${formatTrendBytes(currentMetrics.database.sizeBytes, previousMetrics.database.sizeBytes)} since last check${colors.reset}`);
  }
  
  console.log('─'.repeat(80));
  
  // Record counts section
  console.log(`${colors.bright}${colors.cyan}Record Counts${colors.reset}`);
  
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
    if (previousMetrics) {
      const prevValue = previousMetrics.records[record.name.toLowerCase() as keyof typeof previousMetrics.records];
      if (typeof prevValue === 'number') {
        trend = formatTrendCount(record.value, prevValue);
      }
    }
    
    console.log(`${colors.yellow}${record.name.padEnd(12)}${colors.reset} ${record.value.toString().padStart(5)} ${colors.blue}${bar}${colors.reset} ${trend}`);
  });
  
  console.log('─'.repeat(80));
  
  // WebSocket section
  console.log(`${colors.bright}${colors.cyan}WebSocket Stats${colors.reset}`);
  
  if (currentMetrics.websocket) {
    const ws = currentMetrics.websocket;
    
    console.log(`${colors.yellow}Connections:   ${colors.reset}${ws.activeConnections} active, ${ws.userConnections} user, ${ws.publicConnections} public`);
    console.log(`${colors.yellow}Subscriptions: ${colors.reset}${ws.totalSubscriptions}`);
    
    let msgSentTrend = '';
    let msgRecvTrend = '';
    
    if (previousMetrics && previousMetrics.websocket) {
      msgSentTrend = formatTrendCount(ws.messagesSentLastMinute, previousMetrics.websocket.messagesSentLastMinute);
      msgRecvTrend = formatTrendCount(ws.messagesReceivedLastMinute, previousMetrics.websocket.messagesReceivedLastMinute);
    }
    
    console.log(`${colors.yellow}Messages Sent: ${colors.reset}${ws.messagesSentLastMinute}/min ${msgSentTrend}`);
    console.log(`${colors.yellow}Messages Recv: ${colors.reset}${ws.messagesReceivedLastMinute}/min ${msgRecvTrend}`);
  } else {
    console.log(`${colors.dim}No WebSocket data available${colors.reset}`);
  }
  
  console.log('═'.repeat(80));
  console.log(`${colors.dim}Historical data saved to metrics-history.log${colors.reset}`);
}

// Run dashboard once
showDashboard();
