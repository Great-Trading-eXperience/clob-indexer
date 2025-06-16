#!/usr/bin/env tsx

import { spawn } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

interface MenuItem {
  name: string;
  value: string;
  description: string;
  command: string;
  dangerous?: boolean;
}

interface MenuCategory {
  title: string;
  emoji: string;
  items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
  {
    title: 'Development',
    emoji: '🚀',
    items: [
      {
        name: 'Start Development Server',
        value: 'dev',
        description: 'Start Ponder in development mode with hot reload',
        command: 'pnpm dev'
      },
      {
        name: 'Start Production Server',
        value: 'start',
        description: 'Start Ponder in production mode',
        command: 'pnpm start'
      },
      {
        name: 'Generate Code',
        value: 'codegen',
        description: 'Generate TypeScript code from schema and config',
        command: 'pnpm codegen'
      }
    ]
  },
  {
    title: 'Database',
    emoji: '🗄️',
    items: [
      {
        name: 'Database Operations',
        value: 'db',
        description: 'Run Ponder database operations (migrate, reset, etc.)',
        command: 'pnpm db'
      }
    ]
  },
  {
    title: 'Code Quality',
    emoji: '✨',
    items: [
      {
        name: 'Lint Code',
        value: 'lint',
        description: 'Run ESLint to check for code quality issues',
        command: 'pnpm lint'
      },
      {
        name: 'Type Check',
        value: 'typecheck',
        description: 'Run TypeScript type checking',
        command: 'pnpm typecheck'
      }
    ]
  },
  {
    title: 'Metrics & Monitoring',
    emoji: '📊',
    items: [
      {
        name: 'Check Metrics',
        value: 'metrics',
        description: 'Check current system metrics',
        command: 'pnpm metrics'
      },
      {
        name: 'Start Metrics Monitor',
        value: 'metrics:start',
        description: 'Start the metrics monitoring system',
        command: 'pnpm metrics:start'
      },
      {
        name: 'Watch Metrics',
        value: 'metrics:watch',
        description: 'Watch metrics in real-time',
        command: 'pnpm metrics:watch'
      },
      {
        name: 'Metrics Dashboard',
        value: 'metrics:dashboard',
        description: 'Open the metrics dashboard',
        command: 'pnpm metrics:dashboard'
      },
      {
        name: 'System Monitor',
        value: 'monitor',
        description: 'Run system resource monitoring',
        command: 'pnpm monitor'
      }
    ]
  },
  {
    title: 'Simulation & Testing',
    emoji: '🧪',
    items: [
      {
        name: 'WebSocket Client',
        value: 'ws-client',
        description: 'Run the WebSocket client for testing connections',
        command: 'pnpm ws-client'
      },
      {
        name: 'WebSocket Stress Test',
        value: 'ws-stress-test',
        description: 'Run WebSocket stress testing with configurable parameters',
        command: 'pnpm ws-stress-test'
      },
      {
        name: 'Simulate Market Data',
        value: 'simulate-market',
        description: 'Run real trading simulation to generate WebSocket messages',
        command: 'pnpm simulate-market'
      }
    ]
  }
];

class CLI {
  private currentCategory: MenuCategory | null = null;

  constructor() {
    this.setupExitHandlers();
  }

  private setupExitHandlers(): void {
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Goodbye!'));
      process.exit(0);
    });
  }

  private displayHeader(): void {
    console.clear();
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + '  ' + chalk.white.bold('GTX Indexer Development CLI') + '                 ' + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════╝'));
    console.log();
  }

  private async showMainMenu(): Promise<void> {
    this.displayHeader();
    
    const choices = menuCategories.map(category => ({
      name: `${category.emoji} ${category.title}`,
      value: category.title,
      short: category.title
    }));

    choices.push(
      { name: '───────────────────', value: 'separator', short: '' },
      { name: '🚪 Exit', value: 'exit', short: 'Exit' }
    );

    const { selectedCategory } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCategory',
        message: 'Select a category:',
        choices,
        pageSize: 10
      }
    ]);

    if (selectedCategory === 'exit') {
      console.log(chalk.green('👋 Goodbye!'));
      process.exit(0);
    }

    if (selectedCategory === 'separator') {
      return this.showMainMenu();
    }

    const category = menuCategories.find(cat => cat.title === selectedCategory);
    if (category) {
      this.currentCategory = category;
      await this.showCategoryMenu(category);
    }
  }

  private async showCategoryMenu(category: MenuCategory): Promise<void> {
    this.displayHeader();
    console.log(chalk.blue.bold(`${category.emoji} ${category.title} Commands\n`));

    const choices = category.items.map(item => ({
      name: item.dangerous 
        ? chalk.red(`${item.name} - ${item.description}`)
        : `${item.name} - ${chalk.gray(item.description)}`,
      value: item.value,
      short: item.name
    }));

    choices.push(
      { name: '───────────────────', value: 'separator', short: '' },
      { name: '🔙 Back to Main Menu', value: 'back', short: 'Back' },
      { name: '🚪 Exit', value: 'exit', short: 'Exit' }
    );

    const { selectedCommand } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCommand',
        message: 'Select a command:',
        choices,
        pageSize: 15
      }
    ]);

    if (selectedCommand === 'exit') {
      console.log(chalk.green('👋 Goodbye!'));
      process.exit(0);
    }

    if (selectedCommand === 'back') {
      return this.showMainMenu();
    }

    if (selectedCommand === 'separator') {
      return this.showCategoryMenu(category);
    }

    const menuItem = category.items.find(item => item.value === selectedCommand);
    if (menuItem) {
      await this.executeCommand(menuItem);
    }
  }

  private async executeCommand(menuItem: MenuItem): Promise<void> {
    // Special handling for WebSocket stress test
    if (menuItem.value === 'ws-stress-test') {
      await this.executeStressTest();
      return;
    }

    // Show confirmation for dangerous commands
    if (menuItem.dangerous) {
      console.log(chalk.red.bold('\n⚠️  WARNING: This is a destructive operation!'));
      console.log(chalk.yellow(`Command: ${menuItem.command}`));
      console.log(chalk.yellow(`Description: ${menuItem.description}\n`));

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to proceed?',
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.\n'));
        await this.showPostCommandMenu();
        return;
      }
    }

    console.log(chalk.blue(`\n🚀 Executing: ${chalk.white.bold(menuItem.command)}\n`));

    const [command, ...args] = menuItem.command.split(' ');
    
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        console.log();
        if (code === 0) {
          console.log(chalk.green('✅ Command completed successfully!'));
        } else {
          console.log(chalk.red(`❌ Command failed with exit code ${code}`));
        }
        console.log();
        resolve(this.showPostCommandMenu());
      });

      child.on('error', (error) => {
        console.log(chalk.red(`❌ Error executing command: ${error.message}`));
        resolve(this.showPostCommandMenu());
      });
    });
  }

  private async executeStressTest(): Promise<void> {
    console.log(chalk.blue.bold('\n🔌 WebSocket Stress Test Configuration\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'numClients',
        message: 'Number of concurrent clients:',
        default: '10',
        validate: (input: string) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Please enter a valid number greater than 0';
          }
          if (num > 1000) {
            return 'Warning: Values over 1000 may impact system performance. Continue? (y/N)';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'url',
        message: 'WebSocket server URL:',
        default: 'ws://localhost:42080'
      },
      {
        type: 'checkbox',
        name: 'streams',
        message: 'Select streams to subscribe to:',
        choices: [
          { name: 'mwethmusdc@trade - Trade stream', value: 'mwethmusdc@trade', checked: true },
          { name: 'mwethmusdc@kline_1m - 1-minute kline', value: 'mwethmusdc@kline_1m', checked: true },
          { name: 'mwethmusdc@depth - Order book depth', value: 'mwethmusdc@depth', checked: true },
          { name: 'mwethmusdc@miniTicker - Mini ticker', value: 'mwethmusdc@miniTicker', checked: true }
        ],
        validate: (choices: string[]) => {
          if (choices.length === 0) {
            return 'Please select at least one stream';
          }
          return true;
        }
      },
      {
        type: 'confirm',
        name: 'useUserSockets',
        message: 'Subscribe to user WebSocket connections as well?',
        default: true
      },
      {
        type: 'input',
        name: 'userFile',
        message: 'Path to user addresses file (one address per line):',
        default: './user-addresses.txt',
        when: (answers) => answers.useUserSockets,
        validate: async (input: string) => {
          try {
            const fs = await import('fs');
            if (!fs.existsSync(input)) {
              return `File ${input} does not exist. Please provide a valid file path.`;
            }
            return true;
          } catch {
            return 'Unable to validate file path';
          }
        }
      },
      {
        type: 'input',
        name: 'duration',
        message: 'Test duration in seconds (leave empty for unlimited):',
        default: '',
        validate: (input: string) => {
          if (input === '') return true;
          const num = parseInt(input);
          if (isNaN(num) || num < 1) {
            return 'Please enter a valid number greater than 0 or leave empty for unlimited';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'connectionDelay',
        message: 'Delay between client connections (ms):',
        default: '100',
        validate: (input: string) => {
          const num = parseInt(input);
          if (isNaN(num) || num < 0) {
            return 'Please enter a valid number greater than or equal to 0';
          }
          return true;
        }
      }
    ]);

    // Build command arguments
    const args = [
      '--clients', answers.numClients,
      '--url', answers.url,
      '--streams', answers.streams.join(','),
      '--delay', answers.connectionDelay
    ];

    if (answers.duration) {
      args.push('--duration', answers.duration);
    }

    if (answers.useUserSockets && answers.userFile) {
      args.push('--users', answers.userFile);
    }

    const fullCommand = `tsx ./websocket-client/stress-test.ts ${args.join(' ')}`;

    console.log(chalk.blue(`\n🚀 Executing: ${chalk.white.bold(fullCommand)}\n`));
    console.log(chalk.yellow('💡 Press Ctrl+C to stop the stress test\n'));

    // Show summary
    console.log(chalk.cyan('📋 Configuration Summary:'));
    console.log(`   Clients: ${chalk.white(answers.numClients)}`);
    console.log(`   URL: ${chalk.white(answers.url)}`);
    console.log(`   Streams: ${chalk.white(answers.streams.join(', '))}`);
    if (answers.useUserSockets) {
      console.log(`   User sockets: ${chalk.white('Yes')} (${answers.userFile})`);
    } else {
      console.log(`   User sockets: ${chalk.white('No')}`);
    }
    if (answers.duration) {
      console.log(`   Duration: ${chalk.white(answers.duration)}s`);
    } else {
      console.log(`   Duration: ${chalk.white('Unlimited')}`);
    }
    console.log(`   Connection delay: ${chalk.white(answers.connectionDelay)}ms\n`);

    return new Promise((resolve) => {
      const child = spawn('tsx', ['./websocket-client/stress-test.ts', ...args], {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        console.log();
        if (code === 0) {
          console.log(chalk.green('✅ Stress test completed successfully!'));
        } else {
          console.log(chalk.red(`❌ Stress test failed with exit code ${code}`));
        }
        console.log();
        resolve(this.showPostCommandMenu());
      });

      child.on('error', (error) => {
        console.log(chalk.red(`❌ Error executing stress test: ${error.message}`));
        resolve(this.showPostCommandMenu());
      });
    });
  }

  private async showPostCommandMenu(): Promise<void> {
    const { nextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: '🔄 Run another command from this category', value: 'category' },
          { name: '🏠 Return to main menu', value: 'main' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);

    switch (nextAction) {
      case 'category':
        if (this.currentCategory) {
          await this.showCategoryMenu(this.currentCategory);
        } else {
          await this.showMainMenu();
        }
        break;
      case 'main':
        await this.showMainMenu();
        break;
      case 'exit':
        console.log(chalk.green('👋 Goodbye!'));
        process.exit(0);
        break;
    }
  }

  public async start(): Promise<void> {
    try {
      await this.showMainMenu();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'isTtyError' in error) {
        console.error(chalk.red('❌ This CLI requires an interactive terminal'));
      } else {
        console.error(chalk.red('❌ An unexpected error occurred:'), error);
      }
      process.exit(1);
    }
  }
}

// Start the CLI
const cli = new CLI();
cli.start().catch((error) => {
  console.error(chalk.red('❌ Failed to start CLI:'), error);
  process.exit(1);
});