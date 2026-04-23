const fs = require('fs');
const chalk = require('chalk');

class DidHistory {
  constructor(config) {
    this.config = config;
    this.stats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      writeQueries: 0,
      readQueries: 0,
      connections: 0,
      deniedQueries: 0,
      startTime: Date.now(),
      recentQueries: []
    };
    this.stream = null;

    if (config.ENABLE_AUDIT) {
      this.stream = fs.createWriteStream(config.AUDIT_LOG_FILE, { flags: 'a' });
    }
  }

  log(sql, duration, fromCache, clientIp, db, user, denied = false) {
    this.stats.totalQueries++;
    if (fromCache) this.stats.cacheHits++;
    if (!fromCache && this.isReadOnly(sql)) this.stats.cacheMisses++;
    if (this.isReadOnly(sql)) this.stats.readQueries++;
    if (this.isWrite(sql)) this.stats.writeQueries++;
    if (denied) this.stats.deniedQueries++;

    this.stats.recentQueries.unshift({
      time: new Date().toLocaleTimeString(),
      user,
      sql: sql.substring(0, 80),
      fromCache,
      denied,
      duration
    });
    if (this.stats.recentQueries.length > 50) this.stats.recentQueries.pop();

    if (!this.stream) return;
    this.stream.write(JSON.stringify({
      time: Date.now(),
      clientIp,
      user,
      db,
      sql,
      duration,
      fromCache,
      denied
    }) + '\n');
  }

  isReadOnly(sql) {
    const s = sql.trim().toLowerCase();
    return /^(select|show|describe|explain|set)\s/.test(s);
  }

  isWrite(sql) {
    const s = sql.trim().toLowerCase();
    return /^(insert|update|delete|drop|alter|create|truncate|replace|rename)\s/.test(s);
  }

  extractTable(sql) {
    const m = sql.match(/(?:from|into|update|table)\s+`?(\w+)`?/i);
    return m ? m[1].toLowerCase() : null;
  }

  printStats(cacheSize) {
    const hitRate = this.stats.totalQueries > 0 
      ? Math.round((this.stats.cacheHits / this.stats.totalQueries) * 100) 
      : 0;
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
    
    console.log('');
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan.bold('📊 STATISTICS'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(`  Uptime:       ${Math.floor(uptime/60)}m ${uptime%60}s`);
    console.log(`  Hit Rate:     ${hitRate}% (${this.stats.cacheHits}/${this.stats.totalQueries})`);
    console.log(`  Cache Size:   ${cacheSize} / ${this.config.CACHE_MAX_SIZE}`);
    console.log(`  Connections:  ${this.stats.connections}`);
    console.log(`  Denied:       ${this.stats.deniedQueries}`);
    console.log(chalk.cyan('═'.repeat(50)));
  }

  end() {
    if (this.stream) this.stream.end();
  }
}

module.exports = DidHistory;
