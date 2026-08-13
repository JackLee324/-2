// PM2 进程管理配置 — 崩溃自动重启 + 内存保护
// 使用：npm i -g pm2 && pm2 start ecosystem.config.js
// 常用：pm2 status / pm2 logs / pm2 restart tsinglan-pe-cms / pm2 save
module.exports = {
  apps: [
    {
      name: 'tsinglan-pe-cms',
      script: 'server/index.js',
      instances: 1,               // 单实例（JSON 文件存储，不适合多实例并发写）
      autorestart: true,          // 崩溃自动重启
      max_memory_restart: '300M', // 内存超限自动重启（防泄漏）
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
