import { WebSocket } from "ws";
import * as os from "os";

interface StressTestConfig {
  url: string;
  numClients: number;
  streams: string[];
  userAddresses?: string[];
  pingInterval: number;
  connectionDelay: number;
  duration?: number; // in seconds, optional
}

interface ClientStats {
  id: number;
  connected: boolean;
  messagesReceived: number;
  lastMessageTime: number;
  subscriptions: string[];
  userSocket?: boolean;
}

interface SystemStats {
  timestamp: number;
  memoryUsage: {
    rss: number; // Resident Set Size
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
  systemMemory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  networkConnections: number;
  uptime: number;
}

class StressTestClient {
  private ws: WebSocket | null = null;
  private userWs: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  public stats: ClientStats;
  private config: StressTestConfig;

  constructor(id: number, config: StressTestConfig) {
    this.config = config;
    this.stats = {
      id,
      connected: false,
      messagesReceived: 0,
      lastMessageTime: 0,
      subscriptions: [],
      userSocket: false
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.on("open", () => {
        this.stats.connected = true;
        console.log(`[Client ${this.stats.id}] Connected`);

        // Start ping interval
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: "PING" }));
          }
        }, this.config.pingInterval);

        // Subscribe to streams
        this.subscribeToStreams();
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        this.stats.messagesReceived++;
        this.stats.lastMessageTime = Date.now();
        
        try {
          const message = JSON.parse(data.toString());
          // Optionally log messages (comment out for less noise)
          // console.log(`[Client ${this.stats.id}] Received:`, message);
        } catch (error) {
          console.error(`[Client ${this.stats.id}] Parse error:`, error);
        }
      });

      this.ws.on("close", () => {
        this.stats.connected = false;
        console.log(`[Client ${this.stats.id}] Disconnected`);
        if (this.pingInterval) clearInterval(this.pingInterval);
      });

      this.ws.on("error", (error) => {
        console.error(`[Client ${this.stats.id}] Error:`, error.message);
        this.stats.connected = false;
        reject(error);
      });
    });
  }

  async connectUser(address: string): Promise<void> {
    if (!address) return;

    return new Promise((resolve, reject) => {
      const url = `${this.config.url.replace(/\/$/, "")}/ws/${address.toLowerCase()}`;
      this.userWs = new WebSocket(url);
      this.stats.userSocket = true;

      this.userWs.on("open", () => {
        console.log(`[Client ${this.stats.id}] User socket connected for ${address}`);
        resolve();
      });

      this.userWs.on("message", (data: Buffer) => {
        this.stats.messagesReceived++;
        this.stats.lastMessageTime = Date.now();
        
        try {
          const message = JSON.parse(data.toString());
          // Optionally log user messages
          // console.log(`[Client ${this.stats.id}] User message:`, message);
        } catch (error) {
          console.error(`[Client ${this.stats.id}] User parse error:`, error);
        }
      });

      this.userWs.on("close", () => {
        console.log(`[Client ${this.stats.id}] User socket closed`);
      });

      this.userWs.on("error", (error) => {
        console.error(`[Client ${this.stats.id}] User socket error:`, error.message);
        reject(error);
      });
    });
  }

  private subscribeToStreams(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.config.streams.forEach(stream => {
      this.ws!.send(JSON.stringify({ 
        method: "SUBSCRIBE", 
        params: [stream], 
        id: Date.now() + Math.random() 
      }));
      this.stats.subscriptions.push(stream);
      console.log(`[Client ${this.stats.id}] Subscribed to ${stream}`);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.userWs) {
      this.userWs.close();
      this.userWs = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.stats.connected = false;
  }
}

class StressTestRunner {
  private clients: StressTestClient[] = [];
  private config: StressTestConfig;
  private startTime: number = 0;
  private statsInterval: NodeJS.Timeout | null = null;
  private systemStatsHistory: SystemStats[] = [];
  private initialCpuUsage: NodeJS.CpuUsage | null = null;

  constructor(config: StressTestConfig) {
    this.config = config;
  }

  async run(): Promise<void> {
    console.log(`\n🚀 Starting stress test with ${this.config.numClients} clients`);
    console.log(`📡 Server: ${this.config.url}`);
    console.log(`📊 Streams: ${this.config.streams.join(", ")}`);
    if (this.config.userAddresses?.length) {
      console.log(`👤 User addresses: ${this.config.userAddresses.length} provided`);
    }
    console.log(`⏱️  Connection delay: ${this.config.connectionDelay}ms`);
    if (this.config.duration) {
      console.log(`⏰ Duration: ${this.config.duration} seconds`);
    }
    console.log("");

    this.startTime = Date.now();
    this.initialCpuUsage = process.cpuUsage();

    // Create clients
    for (let i = 0; i < this.config.numClients; i++) {
      const client = new StressTestClient(i + 1, this.config);
      this.clients.push(client);
    }

    // Connect clients with delay
    for (let i = 0; i < this.clients.length; i++) {
      try {
        await this.clients[i].connect();
        
        // Connect user socket if addresses provided - cycle through addresses if more clients than addresses
        if (this.config.userAddresses && this.config.userAddresses.length > 0) {
          const addressIndex = i % this.config.userAddresses.length;
          await this.clients[i].connectUser(this.config.userAddresses[addressIndex]);
        }
      } catch (error) {
        console.error(`Failed to connect client ${i + 1}:`, error);
      }

      // Wait before connecting next client
      if (i < this.clients.length - 1) {
        await this.delay(this.config.connectionDelay);
      }
    }

    // Start stats reporting
    this.startStatsReporting();

    // Run for specified duration or indefinitely
    if (this.config.duration) {
      setTimeout(() => {
        this.stop();
      }, this.config.duration * 1000);
    } else {
      console.log("Press Ctrl+C to stop the test");
    }
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(() => {
      this.printStats();
    }, 5000); // Print stats every 5 seconds
  }

  private printStats(): void {
    const connectedClients = this.clients.filter(c => c.stats.connected).length;
    const totalMessages = this.clients.reduce((sum, c) => sum + c.stats.messagesReceived, 0);
    const avgMessagesPerClient = totalMessages / this.clients.length;
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const messagesPerSecond = totalMessages / elapsedSeconds;

    // Collect current system stats
    const systemStats = this.collectSystemStats();
    this.systemStatsHistory.push(systemStats);

    console.log(`\n📈 Stats (${elapsedSeconds.toFixed(1)}s):`);
    console.log(`🔗 Connected: ${connectedClients}/${this.config.numClients}`);
    console.log(`📨 Total messages: ${totalMessages}`);
    console.log(`📊 Avg messages/client: ${avgMessagesPerClient.toFixed(2)}`);
    console.log(`⚡ Messages/second: ${messagesPerSecond.toFixed(2)}`);
    
    // System performance stats
    console.log(`\n💻 System Performance:`);
    console.log(`🧠 Process Memory:`);
    console.log(`   RSS: ${this.formatBytes(systemStats.memoryUsage.rss)}`);
    console.log(`   Heap Used: ${this.formatBytes(systemStats.memoryUsage.heapUsed)}`);
    console.log(`   Heap Total: ${this.formatBytes(systemStats.memoryUsage.heapTotal)}`);
    console.log(`   External: ${this.formatBytes(systemStats.memoryUsage.external)}`);
    
    console.log(`🖥️  System Memory:`);
    console.log(`   Total: ${this.formatBytes(systemStats.systemMemory.total)}`);
    console.log(`   Used: ${this.formatBytes(systemStats.systemMemory.used)} (${systemStats.systemMemory.percentage.toFixed(1)}%)`);
    console.log(`   Free: ${this.formatBytes(systemStats.systemMemory.free)}`);
    
    console.log(`⚙️  CPU Time:`);
    console.log(`   User: ${this.formatCpuTime(systemStats.cpuUsage.user)}`);
    console.log(`   System: ${this.formatCpuTime(systemStats.cpuUsage.system)}`);
    
    console.log(`🌐 Network: ${systemStats.networkConnections} active connections`);
    
    // Show memory growth if we have history
    if (this.systemStatsHistory.length > 1) {
      const previousStats = this.systemStatsHistory[this.systemStatsHistory.length - 2];
      const memoryGrowth = systemStats.memoryUsage.rss - previousStats.memoryUsage.rss;
      const growthPerSecond = memoryGrowth / 5; // 5 second intervals
      
      if (Math.abs(memoryGrowth) > 1024 * 1024) { // Only show if > 1MB change
        console.log(`📈 Memory Growth: ${memoryGrowth > 0 ? '+' : ''}${this.formatBytes(memoryGrowth)} (${this.formatBytes(growthPerSecond)}/s)`);
      }
    }
    
    // Show individual client stats (first 5 clients only to avoid spam)
    console.log(`\n👥 Individual client stats (first 5):`);
    this.clients.slice(0, 5).forEach(client => {
      console.log(`  Client ${client.stats.id}: ${client.stats.connected ? '✅' : '❌'} | ` +
        `${client.stats.messagesReceived} msgs | ` +
        `${client.stats.subscriptions.length} subs` +
        (client.stats.userSocket ? ' | 👤' : ''));
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private collectSystemStats(): SystemStats {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.initialCpuUsage || undefined);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      timestamp: Date.now(),
      memoryUsage: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      systemMemory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentage: (usedMem / totalMem) * 100,
      },
      networkConnections: this.clients.filter(c => c.stats.connected).length + 
                         this.clients.filter(c => c.stats.userSocket).length,
      uptime: process.uptime(),
    };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private formatCpuTime(microseconds: number): string {
    const seconds = microseconds / 1000000;
    return seconds.toFixed(2) + 's';
  }

  stop(): void {
    console.log("\n🛑 Stopping stress test...");
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.clients.forEach(client => client.disconnect());
    
    // Final stats and performance summary
    setTimeout(() => {
      this.printStats();
      this.printPerformanceSummary();
      console.log("\n✅ Stress test completed");
      process.exit(0);
    }, 1000);
  }

  private printPerformanceSummary(): void {
    if (this.systemStatsHistory.length === 0) return;

    console.log("\n📊 PERFORMANCE SUMMARY & SERVER SIZING RECOMMENDATIONS");
    console.log("=" + "=".repeat(60));

    const firstStats = this.systemStatsHistory[0];
    const lastStats = this.systemStatsHistory[this.systemStatsHistory.length - 1];
    
    if (!firstStats || !lastStats) return;
    
    const testDurationSeconds = (lastStats.timestamp - firstStats.timestamp) / 1000;
    
    // Memory analysis
    const peakMemory = Math.max(...this.systemStatsHistory.map(s => s.memoryUsage.rss));
    const avgMemory = this.systemStatsHistory.reduce((sum, s) => sum + s.memoryUsage.rss, 0) / this.systemStatsHistory.length;
    const memoryGrowth = lastStats.memoryUsage.rss - firstStats.memoryUsage.rss;
    const memoryPerClient = peakMemory / this.config.numClients;

    console.log(`\n🧠 Memory Analysis:`);
    console.log(`   Clients tested: ${this.config.numClients}`);
    console.log(`   Peak memory: ${this.formatBytes(peakMemory)}`);
    console.log(`   Average memory: ${this.formatBytes(avgMemory)}`);
    console.log(`   Memory per client: ${this.formatBytes(memoryPerClient)}`);
    console.log(`   Total growth: ${this.formatBytes(memoryGrowth)}`);
    
    // Performance projections
    const memoryFor1000 = memoryPerClient * 1000;
    const memoryFor5000 = memoryPerClient * 5000;
    const memoryFor10000 = memoryPerClient * 10000;

    console.log(`\n📈 Scaling Projections:`);
    console.log(`   1,000 clients: ~${this.formatBytes(memoryFor1000)}`);
    console.log(`   5,000 clients: ~${this.formatBytes(memoryFor5000)}`);
    console.log(`   10,000 clients: ~${this.formatBytes(memoryFor10000)}`);

    // Server recommendations
    console.log(`\n🖥️  Server Sizing Recommendations:`);
    
    const recommendRAM = (clients: number) => {
      const estimatedMemory = memoryPerClient * clients;
      const osOverhead = 2 * 1024 * 1024 * 1024; // 2GB for OS
      const bufferMultiplier = 2; // 100% buffer
      return (estimatedMemory + osOverhead) * bufferMultiplier;
    };

    console.log(`   For 1,000 clients: ${this.formatBytes(recommendRAM(1000))} RAM minimum`);
    console.log(`   For 5,000 clients: ${this.formatBytes(recommendRAM(5000))} RAM minimum`);
    console.log(`   For 10,000 clients: ${this.formatBytes(recommendRAM(10000))} RAM minimum`);

    // Network analysis
    const totalConnections = this.config.numClients * 2; // public + user sockets
    console.log(`\n🌐 Network Analysis:`);
    console.log(`   Total connections: ${totalConnections} (${this.config.numClients} clients × 2 sockets)`);
    console.log(`   Connection overhead: ~${Math.round(totalConnections * 4)}KB (file descriptors)`);

    // CPU analysis
    const totalCpuTime = lastStats.cpuUsage.user + lastStats.cpuUsage.system;
    const cpuPerSecond = totalCpuTime / testDurationSeconds / 1000000; // convert to seconds
    console.log(`\n⚙️  CPU Analysis:`);
    console.log(`   Total CPU time: ${this.formatCpuTime(totalCpuTime)}`);
    console.log(`   CPU usage rate: ${cpuPerSecond.toFixed(2)}s/s (${(cpuPerSecond * 100).toFixed(1)}%)`);

    // Warnings
    console.log(`\n⚠️  Important Notes:`);
    console.log(`   • These estimates are for websocket clients only`);
    console.log(`   • Actual server load depends on message throughput`);
    console.log(`   • Add 50-100% buffer for production workloads`);
    console.log(`   • Monitor actual performance under realistic traffic patterns`);
    console.log(`   • Consider horizontal scaling for >10k concurrent connections`);
    
    console.log("\n" + "=".repeat(61));
  }
}

// Default configuration
const defaultConfig: StressTestConfig = {
  url: process.env.WEBSOCKET_URL || 'ws://localhost:42080',
  numClients: 10,
  streams: ['mwethmusdc@trade', 'mwethmusdc@kline_1m', 'mwethmusdc@depth', 'mwethmusdc@miniTicker'],
  pingInterval: 30000,
  connectionDelay: 100, // 100ms between connections
  duration: undefined // Run indefinitely
};

// Parse command line arguments
async function parseArgs(): Promise<StressTestConfig> {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--clients':
      case '-c':
        config.numClients = parseInt(args[++i] || '10') || 10;
        break;
      case '--url':
      case '-u':
        config.url = args[++i] || config.url;
        break;
      case '--streams':
      case '-s':
        config.streams = args[++i]?.split(',') || config.streams;
        break;
      case '--duration':
      case '-d':
        config.duration = parseInt(args[++i] || '0');
        break;
      case '--delay':
        config.connectionDelay = parseInt(args[++i] || '100') || 100;
        break;
      case '--users':
        const userFile = args[++i];
        if (userFile) {
          try {
            const fs = await import('fs');
            const addresses = fs.readFileSync(userFile, 'utf8')
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0);
            config.userAddresses = addresses;
          } catch (error) {
            console.error('Failed to read user addresses file:', error);
          }
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npm run stress-test [options]

Options:
  -c, --clients <n>      Number of concurrent clients (default: 10)
  -u, --url <url>        WebSocket server URL (default: ws://localhost:42080)
  -s, --streams <list>   Comma-separated list of streams (default: mwethmusdc@trade,mwethmusdc@depth)
  -d, --duration <sec>   Test duration in seconds (default: unlimited)
  --delay <ms>           Delay between connections in ms (default: 100)
  --users <file>         File containing user addresses (one per line)
  -h, --help             Show this help

Examples:
  npm run stress-test -c 50 -d 60
  npm run stress-test --clients 100 --streams "mwethmusdc@trade,mwethmusdc@kline_1m"
  npm run stress-test --users ./user-addresses.txt -c 100
        `);
        process.exit(0);
        break;
    }
  }

  return config;
}

// Handle graceful shutdown
let globalRunner: StressTestRunner | null = null;

process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
  if (globalRunner) {
    globalRunner.stop();
  } else {
    process.exit(0);
  }
});

// Main execution
(async () => {
  const config = await parseArgs();
  const runner = new StressTestRunner(config);
  globalRunner = runner;
  await runner.run().catch(console.error);
})();