// Define PM2 config interface
interface Pm2AppConfig {
    name: string;
    script: string;
    args?: string;
    autorestart?: boolean;
    watch?: boolean | string[];
    restart_delay?: number;
    env?: Record<string, string>;
}

interface Pm2Config {
    apps: Pm2AppConfig[];
}

const config: Pm2Config = {
    apps: [
        {
            name: "ponder-pg",
            script: "./start-ponder-dev.sh",
            args: "42069 pg-ponder.config.ts",
            autorestart: true,
            watch: false,
            restart_delay: 2000,
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};

export default config;
