const LinkVMUser = require('./src/LinkVMUser');
const ReadConfig = require('./src/ReadConfig');
const chalk = require('chalk');

console.log('');
console.log(chalk.bold.blue('═══════════════════════════════════════════════════════'));
console.log(chalk.bold.white('       UNIT TEST: TABLE PERMISSION MATCHER'));
console.log(chalk.bold.blue('═══════════════════════════════════════════════════════'));
console.log('');

const CONFIG = new ReadConfig().get();
const vmUser = new LinkVMUser(CONFIG);

const TEST_CASES = [
  {
    user: 'reader',
    sql: 'SELECT * FROM yxpil.ai_chat_message',
    desc: 'reader reads yxpil.ai_chat_message',
    expect: true
  },
  {
    user: 'reader',
    sql: 'SELECT * FROM yxpil.blogs',
    desc: 'reader reads yxpil.blogs',
    expect: true
  },
  {
    user: 'reader',
    sql: 'UPDATE yxpil.blogs SET title="test" WHERE id=1',
    desc: 'reader tries WRITE',
    expect: false
  },
  {
    user: 'guest',
    sql: 'SELECT * FROM yxpil.ai_chat_message',
    desc: 'guest reads allowed table',
    expect: true
  },
  {
    user: 'guest',
    sql: 'SELECT * FROM yxpil.advertiser_info',
    desc: 'guest reads forbidden table',
    expect: false
  },
  {
    user: 'admin',
    sql: 'DELETE FROM yxpil.blogs WHERE id=1',
    desc: 'admin writes anything',
    expect: true
  },
  {
    user: 'guest',
    sql: 'SHOW TABLES',
    desc: 'guest runs SHOW TABLES',
    expect: true
  },
  {
    user: 'guest',
    sql: 'SET NAMES utf8mb4',
    desc: 'guest runs SET command',
    expect: true
  },
  {
    user: 'reader',
    sql: 'SELECT * FROM information_schema.tables',
    desc: 'reader reads information_schema',
    expect: true
  }
];

let passed = 0;
let failed = 0;

for (const tc of TEST_CASES) {
  const result = vmUser.checkPermission(tc.sql, tc.user);
  const ok = result === tc.expect;
  
  if (ok) passed++;
  else failed++;
  
  const status = ok ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
  const info = ok ? '' : chalk.gray(` (got: ${result}, expected: ${tc.expect})`);
  
  console.log(`  ${status} ${tc.desc.padEnd(35)} ${info}`);
}

console.log('');
console.log(chalk.bold(`  Results: ${chalk.green(passed + ' passed')}, ${failed > 0 ? chalk.red(failed + ' failed') : chalk.gray('0 failed')}`));
console.log('');

const tables = vmUser.extractTables('SELECT a.*, b.name FROM `yxpil`.ai_chat_message a JOIN yxpil.users b ON a.user_id = b.id');
console.log(chalk.gray('  Table extraction test: ' + tables.join(', ')));
console.log('');

console.log(chalk.bold.yellow('  User Configuration:'));
for (const [name, u] of Object.entries(vmUser.users)) {
  console.log(chalk.cyan(`\n    ${name}:`));
  console.log(chalk.gray(`      READ:  ${u.readTables.join(', ')}`));
  console.log(chalk.gray(`      WRITE: ${u.writeTables.length > 0 ? u.writeTables.join(', ') : '(none)'}`));
}
console.log('');
