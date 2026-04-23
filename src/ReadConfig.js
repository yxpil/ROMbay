const path = require('path');

class ReadConfig {
  constructor() {
    this.config = {
      PROXY_PORT: 3307,
      ADMIN_PANEL_PORT: 7260,

      MASTER_DB: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '请输入自己的密码'
      },

      ENABLE_VIRTUAL_AUTH: true,
      READ_WRITE_SPLIT: false,

      CACHE_MAX_SIZE: 10000,
      CACHE_TTL: 900000,
      ENABLE_CACHE: true,
      CACHE_INVALIDATE_ON_WRITE: true,

      ENABLE_AUDIT: true,
      AUDIT_LOG_FILE: path.join(process.cwd(), 'audit.log'),
      STATS_INTERVAL: 30000
    };
  }

  get() {
    return this.config;
  }
}

module.exports = ReadConfig;
