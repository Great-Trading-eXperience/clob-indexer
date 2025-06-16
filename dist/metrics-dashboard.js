#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var url_1 = require("url");
var readline_1 = __importDefault(require("readline"));
var child_process_1 = require("child_process");
// Use CommonJS-style __dirname in ESM
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
// ANSI color codes
var colors = {
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
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
function formatUptime(seconds) {
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    return "".concat(hours, "h ").concat(minutes, "m");
}
function formatTrend(current, previous) {
    var diff = current - previous;
    if (diff === 0)
        return "".concat(colors.dim, "=").concat(colors.reset);
    return diff > 0
        ? "".concat(colors.green, "\u25B2 ").concat(diff.toFixed(2)).concat(colors.reset)
        : "".concat(colors.red, "\u25BC ").concat(Math.abs(diff).toFixed(2)).concat(colors.reset);
}
function formatTrendBytes(current, previous) {
    var diff = current - previous;
    if (diff === 0)
        return "".concat(colors.dim, "=").concat(colors.reset);
    return diff > 0
        ? "".concat(colors.green, "\u25B2 ").concat(formatBytes(diff)).concat(colors.reset)
        : "".concat(colors.red, "\u25BC ").concat(formatBytes(Math.abs(diff))).concat(colors.reset);
}
function formatTrendCount(current, previous) {
    var diff = current - previous;
    if (diff === 0)
        return "".concat(colors.dim, "=").concat(colors.reset);
    return diff > 0
        ? "".concat(colors.green, "\u25B2 ").concat(diff).concat(colors.reset)
        : "".concat(colors.red, "\u25BC ").concat(Math.abs(diff)).concat(colors.reset);
}
function drawProgressBar(value, max, width) {
    if (width === void 0) { width = 20; }
    var percentage = max > 0 ? (value / max) * 100 : 0;
    var filledWidth = Math.round((percentage / 100) * width);
    var emptyWidth = width - filledWidth;
    var color = colors.green;
    if (percentage > 70)
        color = colors.yellow;
    if (percentage > 90)
        color = colors.red;
    return "".concat(color).concat('█'.repeat(filledWidth)).concat(colors.dim).concat('░'.repeat(emptyWidth)).concat(colors.reset, " ").concat(percentage.toFixed(1), "%");
}
// Clear screen
function clearScreen() {
    console.clear();
    process.stdout.write('\x1B[0f');
}
// Format date to local time string
function formatDateTime(timestamp) {
    if (!timestamp) {
        return new Date().toLocaleString();
    }
    var date = new Date(timestamp);
    return date.toLocaleString();
}
// Save metrics to history log
function saveMetricsHistory(metrics) {
    var historyLogFile = path_1.default.join(__dirname, '..', 'logs', 'metrics-history.log');
    var logDir = path_1.default.dirname(historyLogFile);
    if (!fs_1.default.existsSync(logDir)) {
        fs_1.default.mkdirSync(logDir, { recursive: true });
    }
    var logEntry = JSON.stringify(metrics) + '\n';
    fs_1.default.appendFileSync(historyLogFile, logEntry);
}
// Function to collect fresh metrics directly
function collectFreshMetrics() {
    // Get memory usage
    var memoryUsage = process.memoryUsage();
    // Get database size and record counts
    var dbSizeBytes = 0;
    var dbSizeMB = 0;
    var records = {
        pools: 0,
        orders: 0,
        trades: 0,
        depth: 0,
        balances: 0
    };
    try {
        // Get database size using psql
        var dbUrl = process.env.PONDER_DATABASE_URL;
        if (dbUrl) {
            var dbName = dbUrl.split('/').pop() || 'postgres';
            var sizeQuery = "SELECT pg_database_size('".concat(dbName, "') as size;");
            var sizeResult = (0, child_process_1.execSync)("psql \"".concat(dbUrl, "\" -t -c \"").concat(sizeQuery, "\"")).toString().trim();
            dbSizeBytes = parseInt(sizeResult, 10);
            dbSizeMB = dbSizeBytes / (1024 * 1024);
            // Get record counts
            var countQueries = {
                pools: "SELECT COUNT(*) FROM \"Pool\"",
                orders: "SELECT COUNT(*) FROM \"Order\"",
                trades: "SELECT COUNT(*) FROM \"Trade\"",
                depth: "SELECT COUNT(*) FROM \"DepthLevel\"",
                balances: "SELECT COUNT(*) FROM \"Balance\""
            };
            for (var _i = 0, _a = Object.entries(countQueries); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], query = _b[1];
                try {
                    var result = (0, child_process_1.execSync)("psql \"".concat(dbUrl, "\" -t -c \"").concat(query, "\"")).toString().trim();
                    records[key] = parseInt(result, 10) || 0;
                }
                catch (e) {
                    console.error("Error getting ".concat(key, " count:"), e);
                }
            }
        }
    }
    catch (e) {
        console.error('Error getting database metrics:', e);
    }
    // Get WebSocket stats from log file (we can't easily get these directly)
    var logFile = path_1.default.join(__dirname, '..', 'logs', 'system-metrics.log');
    var wsStats = {
        activeConnections: 0,
        totalSubscriptions: 0,
        userConnections: 0,
        publicConnections: 0,
        messagesSentLastMinute: 0,
        messagesReceivedLastMinute: 0
    };
    try {
        if (fs_1.default.existsSync(logFile)) {
            var content = fs_1.default.readFileSync(logFile, 'utf8');
            var lines = content.split('\n').filter(function (line) { return line.trim(); });
            if (lines.length > 0) {
                var lastLine = lines[lines.length - 1];
                if (lastLine) { // Ensure lastLine is not undefined
                    try {
                        var lastMetrics = JSON.parse(lastLine);
                        if (lastMetrics && lastMetrics.websocket) {
                            wsStats = lastMetrics.websocket;
                        }
                    }
                    catch (parseError) {
                        console.error('Error parsing metrics JSON:', parseError);
                    }
                }
            }
        }
    }
    catch (e) {
        console.error('Error getting WebSocket stats:', e);
    }
    // Create fresh metrics object
    var freshMetrics = {
        timestamp: new Date().toISOString(),
        database: {
            sizeBytes: dbSizeBytes,
            sizeMB: dbSizeMB
        },
        memory: {
            rss: memoryUsage.rss / (1024 * 1024), // Convert to MB
            heapTotal: memoryUsage.heapTotal / (1024 * 1024),
            heapUsed: memoryUsage.heapUsed / (1024 * 1024),
            external: memoryUsage.external / (1024 * 1024)
        },
        records: records,
        websocket: wsStats,
        uptime: Math.floor(process.uptime() / 60) // Minutes
    };
    // Save these fresh metrics to the log file
    saveMetricsHistory(freshMetrics);
    return freshMetrics;
}
// Main dashboard function
function showDashboard(forceRefresh) {
    if (forceRefresh === void 0) { forceRefresh = false; }
    // Get metrics
    var logFile = path_1.default.join(__dirname, '..', 'logs', 'system-metrics.log');
    var previousMetrics = null;
    var currentMetrics = null;
    try {
        // If manual refresh is requested or it's the first run
        if (forceRefresh) {
            // Update the source tracking
            lastUpdateSource = 'manual';
            lastUpdateTime = Date.now();
            // Get fresh metrics directly from system
            currentMetrics = collectFreshMetrics();
            // Save fresh metrics to history log
            if (currentMetrics) {
                var historyLogFile = path_1.default.join(__dirname, '..', 'logs', 'metrics-history.log');
                fs_1.default.appendFileSync(historyLogFile, JSON.stringify(currentMetrics) + '\n');
                // Store in cache to prevent auto-refresh from overwriting
                cachedCurrentMetrics = currentMetrics;
            }
            // Get previous metrics from log file for comparison
            if (fs_1.default.existsSync(logFile)) {
                var content = fs_1.default.readFileSync(logFile, 'utf8');
                var lines = content.split('\n').filter(function (line) { return line.trim(); });
                if (lines.length >= 2) {
                    var previousLine = lines[lines.length - 2];
                    if (previousLine) {
                        try {
                            previousMetrics = JSON.parse(previousLine);
                            cachedPreviousMetrics = previousMetrics;
                        }
                        catch (e) {
                            console.error('Error parsing previous metrics:', e);
                        }
                    }
                }
            }
        }
        // Auto-refresh mode - only update from log file if we're not in manual mode
        // or if it's been more than one refresh interval since manual refresh
        else if (lastUpdateSource === 'auto' ||
            (Date.now() - lastUpdateTime) > REFRESH_INTERVAL_MS * 2) {
            // Update source tracking
            lastUpdateSource = 'auto';
            lastUpdateTime = Date.now();
            // Read from log file
            if (fs_1.default.existsSync(logFile)) {
                var content = fs_1.default.readFileSync(logFile, 'utf8');
                var lines = content.split('\n').filter(function (line) { return line.trim(); });
                if (lines.length >= 2) {
                    var currentLine = lines[lines.length - 1];
                    var previousLine = lines[lines.length - 2];
                    if (currentLine && previousLine) {
                        try {
                            currentMetrics = JSON.parse(currentLine);
                            previousMetrics = JSON.parse(previousLine);
                            // Update cache
                            cachedCurrentMetrics = currentMetrics;
                            cachedPreviousMetrics = previousMetrics;
                        }
                        catch (e) {
                            console.error('Error parsing metrics:', e);
                        }
                    }
                }
                else if (lines.length === 1) {
                    var line = lines[0];
                    if (line) {
                        try {
                            currentMetrics = JSON.parse(line);
                            cachedCurrentMetrics = currentMetrics;
                        }
                        catch (e) {
                            console.error('Error parsing metrics:', e);
                        }
                    }
                }
            }
        }
    }
    catch (error) {
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
    var now = new Date();
    var header = "".concat(colors.bright).concat(colors.bgBlue).concat(colors.white, " GTX Indexer Metrics Dashboard ").concat(colors.reset, " ").concat(now.toLocaleString());
    var uptimeStr = "Uptime: ".concat(formatUptime(currentMetrics.uptime));
    console.log(header + ' '.repeat(20) + uptimeStr);
    console.log('═'.repeat(80));
    // System resources section
    console.log("".concat(colors.bright).concat(colors.cyan, "System Resources").concat(colors.reset));
    // Memory
    console.log("".concat(colors.yellow, "Memory Usage:  ").concat(colors.reset).concat(drawProgressBar(currentMetrics.memory.heapUsed, currentMetrics.memory.heapTotal), " ").concat(currentMetrics.memory.heapUsed.toFixed(2), " / ").concat(currentMetrics.memory.heapTotal.toFixed(2), " MB"));
    if (previousMetrics) {
        console.log("".concat(colors.dim, "              RSS: ").concat(currentMetrics.memory.rss.toFixed(2), " MB ").concat(formatTrend(currentMetrics.memory.rss, previousMetrics.memory.rss)).concat(colors.reset));
        console.log("".concat(colors.dim, "              External: ").concat(currentMetrics.memory.external.toFixed(2), " MB ").concat(formatTrend(currentMetrics.memory.external, previousMetrics.memory.external)).concat(colors.reset));
    }
    else {
        console.log("".concat(colors.dim, "              RSS: ").concat(currentMetrics.memory.rss.toFixed(2), " MB").concat(colors.reset));
        console.log("".concat(colors.dim, "              External: ").concat(currentMetrics.memory.external.toFixed(2), " MB").concat(colors.reset));
    }
    // Database
    console.log("".concat(colors.yellow, "Database Size: ").concat(colors.reset).concat(currentMetrics.database.sizeMB.toFixed(2), " MB"));
    if (previousMetrics) {
        console.log("".concat(colors.dim, "              ").concat(formatTrendBytes(currentMetrics.database.sizeBytes, previousMetrics.database.sizeBytes), " since last check").concat(colors.reset));
    }
    console.log('─'.repeat(80));
    // Record counts section
    console.log("".concat(colors.bright).concat(colors.cyan, "Record Counts").concat(colors.reset));
    var recordTypes = [
        { name: 'Pools', value: currentMetrics.records.pools },
        { name: 'Orders', value: currentMetrics.records.orders },
        { name: 'Trades', value: currentMetrics.records.trades },
        { name: 'Depth Levels', value: currentMetrics.records.depth },
        { name: 'Balances', value: currentMetrics.records.balances }
    ];
    var maxRecords = Math.max.apply(Math, recordTypes.map(function (r) { return r.value; }));
    recordTypes.forEach(function (record) {
        var barWidth = 30;
        var filledWidth = maxRecords > 0 ? Math.max(1, Math.round((record.value / maxRecords) * barWidth)) : 0;
        var bar = '█'.repeat(filledWidth) + ' '.repeat(barWidth - filledWidth);
        var trend = '';
        if (previousMetrics) {
            var prevValue = previousMetrics.records[record.name.toLowerCase()];
            if (typeof prevValue === 'number') {
                trend = formatTrendCount(record.value, prevValue);
            }
        }
        console.log("".concat(colors.yellow).concat(record.name.padEnd(12)).concat(colors.reset, " ").concat(record.value.toString().padStart(5), " ").concat(colors.blue).concat(bar).concat(colors.reset, " ").concat(trend));
    });
    console.log('─'.repeat(80));
    // WebSocket section
    console.log("".concat(colors.bright).concat(colors.cyan, "WebSocket Stats").concat(colors.reset));
    if (currentMetrics.websocket) {
        var ws = currentMetrics.websocket;
        console.log("".concat(colors.yellow, "Connections:   ").concat(colors.reset).concat(ws.activeConnections, " active, ").concat(ws.userConnections, " user, ").concat(ws.publicConnections, " public"));
        console.log("".concat(colors.yellow, "Subscriptions: ").concat(colors.reset).concat(ws.totalSubscriptions));
        var msgSentTrend = '';
        var msgRecvTrend = '';
        if (previousMetrics && previousMetrics.websocket) {
            msgSentTrend = formatTrendCount(ws.messagesSentLastMinute, previousMetrics.websocket.messagesSentLastMinute);
            msgRecvTrend = formatTrendCount(ws.messagesReceivedLastMinute, previousMetrics.websocket.messagesReceivedLastMinute);
        }
        console.log("".concat(colors.yellow, "Messages Sent: ").concat(colors.reset).concat(ws.messagesSentLastMinute, "/min ").concat(msgSentTrend));
        console.log("".concat(colors.yellow, "Messages Recv: ").concat(colors.reset).concat(ws.messagesReceivedLastMinute, "/min ").concat(msgRecvTrend));
    }
    else {
        console.log("".concat(colors.dim, "No WebSocket data available").concat(colors.reset));
    }
    console.log('═'.repeat(80));
    console.log("".concat(colors.dim, "Historical data saved to metrics-history.log").concat(colors.reset));
    // Display last updated timestamp
    if (currentMetrics && currentMetrics.timestamp) {
        console.log("".concat(colors.dim, "Last updated: ").concat(formatDateTime(currentMetrics.timestamp)).concat(colors.reset));
    }
}
// Dashboard settings
var REFRESH_INTERVAL_MS = 3000;
var autoRefresh = true;
// Cache for metrics data
var cachedCurrentMetrics = null;
var cachedPreviousMetrics = null;
// Track the source of the last metrics update
var lastUpdateSource = 'manual';
// Track the last update time
var lastUpdateTime = Date.now();
// Display help information
function displayHelp() {
    console.log("".concat(colors.dim).concat(autoRefresh ? "Auto-refreshing every ".concat(REFRESH_INTERVAL_MS / 1000, " seconds.") : 'Auto-refresh is OFF.', " Press:").concat(colors.reset));
    console.log("".concat(colors.dim, "  [r] to refresh manually | [a] to toggle auto-refresh | [Ctrl+C] to exit").concat(colors.reset));
}
// Setup for handling keyboard input
if (process.stdin.isTTY) {
    // Enable raw mode for immediate key detection
    process.stdin.setRawMode(true);
    readline_1.default.emitKeypressEvents(process.stdin);
    process.stdin.on('keypress', function (str, key) {
        if (!key)
            return;
        if (key.ctrl && key.name === 'c') {
            // Exit on Ctrl+C
            console.log('\nDashboard closed');
            process.exit(0);
        }
        else if (key.name === 'r' || key.name === 'R') {
            // Manual refresh on 'r' key press (case insensitive) with fresh metrics
            clearScreen();
            showDashboard(true); // Pass true to force refresh
            displayHelp();
            console.log("".concat(colors.green, "Manual refresh with fresh metrics triggered at ").concat(new Date().toLocaleString(), "!").concat(colors.reset));
        }
        else if (key.name === 'a' || key.name === 'A') {
            // Toggle auto-refresh on 'a' key press (case insensitive)
            autoRefresh = !autoRefresh;
            // When toggling auto-refresh off, get fresh metrics
            if (!autoRefresh) {
                // Force a manual refresh when auto-refresh is disabled
                clearScreen();
                showDashboard(true);
                displayHelp();
                return;
            }
            clearScreen();
            showDashboard();
            displayHelp();
            console.log("".concat(colors.yellow, "Auto-refresh ").concat(autoRefresh ? 'enabled' : 'disabled', "!").concat(colors.reset));
        }
    });
}
// Handle clean exit
process.on('SIGINT', function () {
    console.log('\nDashboard closed');
    process.exit(0);
});
// Initial dashboard display
clearScreen();
showDashboard(true); // Start with fresh metrics
displayHelp();
// Set up the refresh interval
var intervalId = setInterval(function () {
    if (autoRefresh) {
        clearScreen();
        showDashboard(false); // Don't force refresh, let the function decide based on timing
        displayHelp();
    }
}, REFRESH_INTERVAL_MS);
