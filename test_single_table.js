const mysql = require('mysql2/promise');
const chalk = require('chalk');

const PROXY = { host: '127.0.0.1', port: 3307 };

const TEST_MATRIX = [
  {
    user: 'admin',
    pass: '请输入自己的密码',
    table: 'yxpil.ai_chat_message',
    canRead: true,
    canWrite: true,
    desc: 'admin 对任意表有完全权限'
  },
  {
    user: 'reader',
    pass: '请输入自己的密码',
    table: 'yxpil.blogs',
    canRead: true,
    canWrite: false,
    desc: 'reader 对 blogs 只读'
  },
  {
    user: 'reader',
    pass: '请输入自己的密码',
    table: 'yxpil.users',
    canRead: true,
    canWrite: false,
    desc: 'reader 通过 yxpil.* 通配匹配 users 表'
  },
  {
    user: 'guest',
    pass: '请输入自己的密码',
    table: 'yxpil.ai_chat_message',
    canRead: true,
    canWrite: false,
    desc: 'guest 对 ai_chat_message 只读'
  },
  {
    user: 'guest',
    pass: '请输入自己的密码',
    table: 'yxpil.blogs',
    canRead: true,
    canWrite: false,
    desc: 'guest 对 blogs 只读'
  },
  {
    user: 'guest',
    pass: '请输入自己的密码',
    table: 'yxpil.users',
    canRead: false,
    canWrite: false,
    desc: 'guest 禁止访问 users 表'
  },
  {
    user: 'guest',
    pass: '请输入自己的密码',
    table: 'yxpil.advertiser_info',
    canRead: false,
    canWrite: false,
    desc: 'guest 禁止访问 advertiser_info 表'
  }
];

async function testSingleTable() {
  console.log('');
  console.log(chalk.bold.magenta('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║') + chalk.bold.white('             单表单用户权限集成测试                            ') + chalk.bold.magenta('║'));
  console.log(chalk.bold.magenta('╚═══════════════════════════════════════════════════════════════╝'));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_MATRIX) {
    process.stdout.write(chalk.cyan(`  [${tc.user}]`.padEnd(12)));
    process.stdout.write(chalk.gray(`${tc.table}`.padEnd(32)));
    
    let conn;
    let readActual = false;
    let writeActual = false;

    try {
      conn = await mysql.createConnection({
        ...PROXY,
        user: tc.user,
        password: tc.pass,
        timeout: 2000
      });

      try {
        await conn.query(`SELECT 1 FROM ${tc.table} LIMIT 1`);
        readActual = true;
      } catch(e) {
        readActual = false;
      }

      try {
        await conn.query(`UPDATE ${tc.table} SET id = id WHERE 1=0`);
        writeActual = true;
      } catch(e) {
        writeActual = false;
      }

    } catch(e) {
      process.stdout.write(chalk.red('  CONN_FAIL  '));
    } finally {
      if (conn) conn.destroy();
    }

    const readOK = readActual === tc.canRead;
    const writeOK = writeActual === tc.canWrite;
    const allOK = readOK && writeOK;

    if (allOK) passed++;
    else failed++;

    process.stdout.write('  READ: ');
    process.stdout.write(readOK ? chalk.green('✓') : chalk.red('✗'));
    process.stdout.write(readActual ? chalk.green(' [允许]') : chalk.red(' [拒绝]'));

    process.stdout.write('  WRITE: ');
    process.stdout.write(writeOK ? chalk.green('✓') : chalk.red('✗'));
    process.stdout.write(writeActual ? chalk.yellow(' [允许]') : chalk.gray(' [拒绝]'));

    process.stdout.write(allOK ? chalk.green('  ✓ PASS') : chalk.red('  ✗ FAIL'));
    console.log('');
    console.log(chalk.gray(`     ${tc.desc}`));
    console.log('');
  }

  console.log(chalk.bold(`  总计: ${chalk.green(passed + ' 通过')}, ${failed > 0 ? chalk.red(failed + ' 失败') : chalk.gray('0 失败')}`));
  console.log('');
  console.log(chalk.bold.green('  ✅ 全部测试完成!'));
  console.log('');
}

testSingleTable().catch(console.error);

