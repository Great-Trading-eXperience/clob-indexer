import { WebSocket } from "ws";
import readline from "readline";

const config = {
  url: process.env.WEBSOCKET_URL || 'ws://localhost:42080',
  autoReconnect: process.env.AUTO_RECONNECT === "true",
  reconnectInterval: Number(process.env.RECONNECT_INTERVAL) || 3000,
  pingInterval: Number(process.env.PING_INTERVAL) || 30000,
};

type ServerMessage =
  | { id: number | null; result: any }
  | { stream: string; data: any }
  | { method: "PONG" };

interface WebSocketMessage {
  [key: string]: any;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let ws: WebSocket | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function connect(): void {
  if (isConnecting) return;
  isConnecting = true;

  log(colors.blue, "SYSTEM", `Connecting to ${config.url}...`);

  ws = new WebSocket(config.url);

  ws.on("open", () => {
    isConnecting = false;
    log(colors.green, "SYSTEM", "Connected to WebSocket server");
    log(colors.cyan, "HELP", "Type \"commands\" to see available commands");

    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ method: "PING" }));
        log(colors.blue, "PING", "Sent ping");
      }
    }, config.pingInterval);
  });

  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as ServerMessage;

      if ("stream" in message) {
        log(colors.yellow, "STREAM", JSON.stringify(message, null, 2));
      } else if ("result" in message) {
        log(colors.green, "ACK", JSON.stringify(message, null, 2));
      } else if ("method" in message && message.method === "PONG") {
        log(colors.blue, "PONG", "Received pong");
      } else {
        log(colors.red, "UNKWN", JSON.stringify(message, null, 2));
      }
    } catch (error) {
      log(colors.red, "ERROR", `Failed to parse message: ${(error as Error).message}`);
      console.log("Raw message:", data.toString());
    }
  });

  ws.on("close", () => {
    log(colors.red, "SYSTEM", "Disconnected from WebSocket server");
    if (pingInterval) clearInterval(pingInterval);
    isConnecting = false;

    if (config.autoReconnect) {
      log(colors.yellow, "SYSTEM", `Reconnecting in ${config.reconnectInterval / 1000} seconds...`);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connect, config.reconnectInterval);
    }
  });

  ws.on("error", (error) => {
    log(colors.red, "ERROR", `WebSocket error: ${error.message}`);
    isConnecting = false;
  });
}

function processCommand(input: string): void {
  const command = input.trim();

  if (command === "commands" || command === "help") {
    log(colors.cyan, "HELP", "Available commands:");
    console.log(`
  ${colors.cyan}subscribe <stream>${colors.reset}    - Subscribe to a stream (e.g. mwethmusdc@trade)
  ${colors.cyan}unsubscribe <stream>${colors.reset}  - Unsubscribe from a stream
  ${colors.cyan}list${colors.reset}                  - List current subscriptions
  ${colors.cyan}ping${colors.reset}                  - Send a ping message
  ${colors.cyan}reconnect${colors.reset}             - Reconnect to the WebSocket server
  ${colors.cyan}exit${colors.reset}                  - Exit the application
    `);
    return;
  }

  if (command === "exit") {
    log(colors.yellow, "SYSTEM", "Exiting...");
    if (ws) ws.close();
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    rl.close();
    process.exit(0);
    return;
  }

  if (command === "reconnect") {
    log(colors.yellow, "SYSTEM", "Reconnecting...");
    if (ws) ws.close();
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    connect();
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log(colors.red, "ERROR", "Not connected to WebSocket server");
    return;
  }

  if (command === "ping") {
    ws.send(JSON.stringify({ method: "PING" }));
    log(colors.blue, "PING", "Sent ping");
    return;
  }

  if (command.startsWith("subscribe ")) {
    const stream = command.substring("subscribe ".length).trim();
    if (!stream) {
      log(colors.red, "ERROR", "Please provide a stream");
      return;
    }

    ws.send(JSON.stringify({ method: "SUBSCRIBE", params: [stream], id: Date.now() }));
    log(colors.magenta, "SUBSCRIBE", `Subscribing to stream: ${stream}`);
    return;
  }

  if (command.startsWith("unsubscribe ")) {
    const stream = command.substring("unsubscribe ".length).trim();
    if (!stream) {
      log(colors.red, "ERROR", "Please provide a stream");
      return;
    }

    ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: [stream], id: Date.now() }));
    log(colors.magenta, "UNSUBSCRIBE", `Unsubscribing from stream: ${stream}`);
    return;
  }

  if (command === "list") {
    ws.send(JSON.stringify({ method: "LIST_SUBSCRIPTIONS", id: Date.now() }));
    log(colors.magenta, "LIST", "Requested list of subscriptions");
    return;
  }

  log(colors.red, "ERROR", `Unknown command: ${command}. Type "commands" for help.`);
}

log(colors.cyan, "SYSTEM", "CLOB DEX WebSocket Test Client");
log(colors.cyan, "SYSTEM", `Server URL: ${config.url}`);
connect();

rl.on("line", processCommand);
rl.on("close", () => {
  if (ws) ws.close();
  if (pingInterval) clearInterval(pingInterval);
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  process.exit(0);
});