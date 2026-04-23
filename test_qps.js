const mysql = require('mysql2/promise');
const chalk = require('chalk');

const PROXY = { host: '127.0.0.1', port: 3307 };
const DIRECT = { host: '127.0.0.1', port: 3306, user: 'root', password: '请输入自己的密码' };

async function testQPS(name, config, queries = 1000) {
  console.log(`\n  === ${name} ===`);
  
  const conn = await mysql.createConnection({
    ...config,
    user: config.user || 'admin',
    password: config.password || '请输入自己的密码'
  });

  await conn.query('SELECT 1 FROM yxpil.blogs LIMIT 1');
  
  const start = Date.now();
  
  for (let i = 0; i < queries; i++) {
    await conn.query('SELECT 1 FROM yxpil.blogs LIMIT 1');
  }
  
  const elapsed = Date.now() - start;
  const qps = Math.round(queries * 1000 / elapsed);
  
  conn.destroy();
  
  console.log(`  ${queries} 查询 | ${elapsed}ms | QPS: ${chalk.bold.green(qps)}`);
  return qps;
}

async function testConcurrency() {
  console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('           QPS PERFORMANCE TEST            ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════╝\n'));

  const proxyQPS = await testQPS('ROMBay Proxy (RAM Cache)', PROXY, 2000);
  
  console.log('\n  ' + chalk.bold.green('🎉 代理 QPS 测试完成!'));
  console.log('  ' + chalk.gray('(连接池 + 结果集缓存双加速)'));
  console.log('');
}

testConcurrency().catch(console.error);


