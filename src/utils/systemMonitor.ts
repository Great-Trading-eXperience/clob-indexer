import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  websocket: {
    activeConnections: number;
    totalSubscriptions: number;
    userConnections: number;
    publicConnections: number;
    messagesSentLastMinute: number;
    messagesReceivedLastMinute: number;
  };
  uptime: number;
}

class SystemMonitor {
  private logFile: string;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private wsMessagesSent = 0;
  private wsMessagesReceived = 0;
  private wsMessageHistory: Array<{ sent: number; received: number; timestamp: number }> = [];
  private wsStatsCallback: (() => { 
    activeConnections: number; 
    totalSubscriptions: number; 
    userConnections: number; 
    publicConnections: number; 
  }) | null = null;

  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'system-metrics.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  registerWebSocketStatsCallback(callback: () => { 
    activeConnections: number; 
    totalSubscriptions: number; 
    userConnections: number; 
    publicConnections: number; 
  }) {
    this.wsStatsCallback = callback;
  }

  trackWebSocketMessageSent() {
    this.wsMessagesSent++;
  }

  trackWebSocketMessageReceived() {
    this.wsMessagesReceived++;
  }

  private updateWebSocketHistory() {
    const now = Date.now();
    this.wsMessageHistory.push({
      sent: this.wsMessagesSent,
      received: this.wsMessagesReceived,
      timestamp: now
    });

    const fiveMinutesAgo = now - 5 * 60 * 1000;
    this.wsMessageHistory = this.wsMessageHistory.filter(entry => entry.timestamp > fiveMinutesAgo);
  }

  private getWebSocketMetrics() {
    this.updateWebSocketHistory();
    
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Calculate messages sent/received in the last minute
    const recentHistory = this.wsMessageHistory.filter(entry => entry.timestamp > oneMinuteAgo);
    const messagesSentLastMinute = recentHistory.length > 0 
      ? this.wsMessagesSent - (recentHistory[0]?.sent || 0)
      : 0;
    const messagesReceivedLastMinute = recentHistory.length > 0 
      ? this.wsMessagesReceived - (recentHistory[0]?.received || 0)
      : 0;

    // Get connection stats from WebSocket server if callback is registered
    const connectionStats = this.wsStatsCallback?.() || {
      activeConnections: 0,
      totalSubscriptions: 0,
      userConnections: 0,
      publicConnections: 0
    };

    return {
      ...connectionStats,
      messagesSentLastMinute,
      messagesReceivedLastMinute
    };
  }

  async collectMetrics(): Promise<SystemMetrics> {
    try {
      // Get database size using psql command
      const dbSizeCommand = `psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT pg_database_size(current_database())"`;
      const dbSizeResult = await execAsync(dbSizeCommand);
      const databaseSizeBytes = parseInt(dbSizeResult.stdout.trim()) || 0;

      // Get memory usage
      const memoryUsage = process.memoryUsage();

      // Get record counts using psql commands
      const tableCountPromises = [
        execAsync(`psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM pools"`),
        execAsync(`psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM orders"`),
        execAsync(`psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM order_book_trades"`),
        execAsync(`psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM order_book_depth"`),
        execAsync(`psql "${process.env.PONDER_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM balances"`),
      ];

      const recordCounts = await Promise.all(tableCountPromises);

      const wsMetrics = this.getWebSocketMetrics();
      
      return {
        timestamp: new Date().toISOString(),
        database: {
          sizeBytes: databaseSizeBytes,
          sizeMB: Math.round(databaseSizeBytes / 1024 / 1024 * 100) / 100
        },
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
          external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100
        },
        records: {
          pools: parseInt(recordCounts[0]?.stdout?.trim() || '0') || 0,
          orders: parseInt(recordCounts[1]?.stdout?.trim() || '0') || 0,
          trades: parseInt(recordCounts[2]?.stdout?.trim() || '0') || 0,
          depth: parseInt(recordCounts[3]?.stdout?.trim() || '0') || 0,
          balances: parseInt(recordCounts[4]?.stdout?.trim() || '0') || 0
        },
        websocket: wsMetrics,
        uptime: Math.round(process.uptime())
      };
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }

  private logMetrics(metrics: SystemMetrics) {
    const logEntry = JSON.stringify(metrics) + '\n';
    
    fs.appendFileSync(this.logFile, logEntry);
    
    this.trimLogFile();
  }

  private trimLogFile() {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length > 1000) {
        const trimmedContent = lines.slice(-1000).join('\n') + '\n';
        fs.writeFileSync(this.logFile, trimmedContent);
      }
    } catch (error) {
      console.error('Error trimming log file:', error);
    }
  }

  start(intervalMinutes: number = 5) {
    if (this.isRunning) {
      console.log('System monitor already running');
      return;
    }

    console.log(`Starting system monitor, logging every ${intervalMinutes} minutes to ${this.logFile}`);
    this.isRunning = true;

    this.collectMetrics()
      .then(metrics => this.logMetrics(metrics))
      .catch(error => console.error('Error logging initial metrics:', error));

    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.logMetrics(metrics);
      } catch (error) {
        console.error('Error in monitoring interval:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('System monitor stopped');
  }

  getRecentMetrics(count: number = 10): SystemMetrics[] {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      return lines
        .slice(-count)
        .map(line => JSON.parse(line))
        .reverse(); // Most recent first
    } catch (error) {
      console.error('Error reading metrics log:', error);
      return [];
    }
  }
}

// Export singleton instance
export const systemMonitor = new SystemMonitor();