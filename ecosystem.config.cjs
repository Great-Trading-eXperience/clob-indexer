module.exports = {
    apps: [
        {
            name: "ponder-pg",
            script: "./start-ponder-dev.sh",
            args: "42069 rise pg-ponder.config.ts",
            autorestart: true,
            watch: false,
            restart_delay: 2000,
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};