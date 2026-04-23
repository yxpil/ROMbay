const LinkVMUser = require('./src/LinkVMUser');
const ReadConfig = require('./src/ReadConfig');
const chalk = require('chalk');

console.log('');
console.log(chalk.bold.magenta('╔═════════════════════════════════════════════════════════════╗'));
console.log(chalk.bold.magenta('║') + chalk.bold.white('               50 TABLE USERS UNIT TEST                      ') + chalk.bold.magenta('║'));
console.log(chalk.bold.magenta('╚═════════════════════════════════════════════════════════════╝'));
console.log('');

const CONFIG = new ReadConfig().get();
const vmUser = new LinkVMUser(CONFIG);

const credentials = require('./table_credentials.json');
console.log(chalk.gray(`  Loaded ${Object.keys(vmUser.users).length} total users\n`));

let passed = 0;
let failed = 0;

for (const cred of credentials.slice(0, 25)) {
  process.stdout.write(`  ${cred.username.padEnd(18)} -> ${chalk.cyan(cred.table.padEnd(22))}`);

  const ownRead = vmUser.checkPermission(`SELECT * FROM yxpil.\`${cred.table}\``, cred.username);
  const ownWrite = vmUser.checkPermission(`UPDATE yxpil.\`${cred.table}\` SET id=1`, cred.username);
  
  const otherTable = cred.table === 'blogs' ? 'user' : 'blogs';
  const otherRead = vmUser.checkPermission(`SELECT * FROM yxpil.\`${otherTable}\``, cred.username);
  const otherWrite = vmUser.checkPermission(`DELETE FROM yxpil.\`${otherTable}\``, cred.username);

  const ownOK = ownRead && ownWrite;
  const otherOK = !otherRead && !otherWrite;
  const allOK = ownOK && otherOK;

  process.stdout.write('  自有表: ');
  process.stdout.write(ownOK ? chalk.green('✅') : chalk.red('❌'));
  
  process.stdout.write('  跨表隔离: ');
  process.stdout.write(otherOK ? chalk.green('🔒') : chalk.red('⚠️ 泄漏!'));

  if (allOK) { passed++; process.stdout.write(chalk.green('  ✓')); }
  else { failed++; process.stdout.write(chalk.red('  ✗')); }
  console.log('');
}

console.log('');
console.log(chalk.bold(`  结果: ${chalk.green(passed + ' 通过')}, ${failed > 0 ? chalk.red(failed + ' 失败') : chalk.gray('0 失败')}`));

if (failed === 0) {
  console.log(chalk.bold.green('\n  🎉 全部通过! 权限系统工作正常!'));
  console.log(chalk.gray('\n  👉 注意: 测试真实 MySQL 连接需要重启代理以加载新用户'));
}
console.log('');
