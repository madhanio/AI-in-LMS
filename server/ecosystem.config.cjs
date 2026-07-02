module.exports = {
  apps: [
    {
      name: "moodle-ai-backend",
      script: "./index.js",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "450M",
      env: {
        NODE_ENV: "production",
	PORT: 3000
      }
    }
  ]
};
