const chalk = require('chalk');

const ReadConfig = require('./src/ReadConfig');
const DidHistory = require('./src/DidHistory');
const LinkUPsql = require('./src/LinkUPsql');
const LinkVMUser = require('./src/LinkVMUser');
const RomFromer = require('./src/RomFromer');

const CONFIG = new ReadConfig().get();
const history = new DidHistory(CONFIG);
const upSql = new LinkUPsql(CONFIG);
const vmUser = new LinkVMUser(CONFIG);
const proxy = new RomFromer(CONFIG, vmUser, upSql, history);

console.log('');
console.log(chalk.bold.blue('╔') + chalk.bold.blue('═'.repeat(60)) + chalk.bold.blue('╗'));
console.log(chalk.bold.blue('║') + chalk.bold.white('           MySQL PROXY AUDIT                              ') + chalk.bold.blue('║'));
console.log(chalk.bold.blue('╚') + chalk.bold.blue('═'.repeat(60)) + chalk.bold.blue('╝'));
console.log('');

proxy.start(CONFIG.PROXY_PORT, () => {
  console.log(chalk.white('  🚀 Proxy Port:   ') + chalk.bold.green(CONFIG.PROXY_PORT));
});

console.log(chalk.white('  📦 MySQL:        ') + chalk.bold.yellow(`${CONFIG.MASTER_DB.host}:${CONFIG.MASTER_DB.port}`));
console.log(chalk.white('  💾 Cache:        ') + chalk.bold[CONFIG.ENABLE_CACHE ? 'green' : 'gray'](CONFIG.ENABLE_CACHE ? 'ENABLED' : 'DISABLED'));
console.log(chalk.white('  🔐 Virtual Auth: ') + chalk.bold[CONFIG.ENABLE_VIRTUAL_AUTH ? 'green' : 'gray'](CONFIG.ENABLE_VIRTUAL_AUTH ? 'ENABLED' : 'DISABLED'));
console.log('');

if (CONFIG.ENABLE_VIRTUAL_AUTH) {
  console.log(chalk.gray('  Virtual Users:'));
  for (const name of Object.keys(vmUser.users)) {
    const u = vmUser.getUser(name);
    const r = u.readTables.includes('*') ? '📖 ALL' : `📖 ${u.readTables.length} tbls`;
    const w = u.writeTables.includes('*') ? '✏️ ALL' : u.writeTables.length > 0 ? `✏️ ${u.writeTables.length} tbls` : '🔒 NO WRITE';
    console.log(chalk.gray(`    - ${name}:${u.password}`));
    console.log(chalk.gray(`        ${r} | ${w}`));
  }
  console.log(chalk.gray(`  Connect: mysql -h 127.0.0.1 -P ${CONFIG.PROXY_PORT} -u admin -p[YOUR_SECURE_PASSWORD]`));
} else {
  console.log(chalk.gray(`  Connect: mysql -h 127.0.0.1 -P ${CONFIG.PROXY_PORT} -u root -p${CONFIG.MASTER_DB.password}`));
}
console.log('');

setInterval(() => {
  history.printStats(upSql.getCacheSize());
}, CONFIG.STATS_INTERVAL);

process.on('SIGINT', () => {
  console.log(chalk.yellow('\nBye!'));
  history.printStats(upSql.getCacheSize());
  history.end();
  process.exit(0);
});
