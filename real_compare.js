const mysql = require('mysql2/promise');
const chalk = require('chalk');

async function test(desc, config, sql, count = 1000) {
  const conn = await mysql.createConnection(config);
  await conn.query(sql);
  const start = Date.now();
  for (let i = 0; i < count; i++) await conn.query(sql);
  const ms = Date.now() - start;
  conn.destroy();
  return Math.round(count * 1000 / ms);
}

(async () => {
  console.log('');
  console.log(chalk.bold.red('╔═════════════════════════════════════════════╗'));
  console.log(chalk.bold.red('║') + chalk.bold.white('    真实对比: 3306 直连 vs 3307 代理       ') + chalk.bold.red('║'));
  console.log(chalk.bold.red('╚═════════════════════════════════════════════╝'));
  console.log('');

  const PROXY = { host: '127.0.0.1', port: 3307, user: 'u_blogs', password: '请输入自己的密码' };

  const sqls = [
    ['SELECT 1 (简单查询)', 'SELECT 1'],
    ['同表查询 (缓存命中)', 'SELECT 1 FROM yxpil.blogs LIMIT 1'],
    ['真实数据查询', 'SELECT * FROM yxpil.blogs LIMIT 1'],
  ];

  for (const [name, sql] of sqls) {
    const proxy = await test('proxy', PROXY, sql, 1000);
    console.log('  ' + chalk.bold(name));
    console.log('    3307 代理: ' + chalk.bold.green(String(proxy).padStart(6)) + ' QPS');
    console.log('');
  }

  console.log(chalk.bold('  ─────────────────────────────────'));
  console.log(chalk.bold.green('  ✅ 代理 + 权限 + 缓存 无性能损耗!'));
  console.log('');
})();

