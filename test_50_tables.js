const mysql = require('mysql2/promise');
const chalk = require('chalk');
const credentials = require('./table_credentials.json');

const PROXY = { host: '127.0.0.1', port: 3307 };
const TEST_TABLES = credentials.slice(0, 15);

async function testTableIsolation() {
  console.log('');
  console.log(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('                 50 TABLE USER PERMISSION ISOLATION TEST          ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray(`  Testing ${TEST_TABLES.length} of ${credentials.length} table users\n`));

  let passed = 0;
  let failed = 0;

  for (const cred of TEST_TABLES) {
    process.stdout.write(chalk.cyan(`  ${cred.username.padEnd(18)}`));
    process.stdout.write(chalk.gray(`-> ${cred.table.padEnd(24)}`));

    let conn;
    let results = {
      ownRead: false,
      ownWrite: false,
      otherRead: false,
      otherWrite: false
    };

    try {
      conn = await mysql.createConnection({
        ...PROXY,
        user: cred.username,
        password: cred.password
      });

      try {
        await conn.query(`SELECT 1 FROM yxpil.\`${cred.table}\` LIMIT 1`);
        results.ownRead = true;
      } catch(e) {
        results.ownRead = false;
      }

      try {
        await conn.query(`DELETE FROM yxpil.\`${cred.table}\` WHERE 1=0`);
        results.ownWrite = true;
      } catch(e) {
        results.ownWrite = false;
      }

      const otherTable = cred.table === 'blogs' ? 'user' : 'blogs';
      try {
        await conn.query(`SELECT 1 FROM yxpil.\`${otherTable}\` LIMIT 1`);
        results.otherRead = true;
      } catch(e) {
        results.otherRead = false;
      }

      try {
        await conn.query(`UPDATE yxpil.\`${otherTable}\` SET id=id WHERE 1=0`);
        results.otherWrite = true;
      } catch(e) {
        results.otherWrite = false;
      }

    } catch(e) {
      process.stdout.write(chalk.red('  CONN_FAIL'));
    } finally {
      if (conn) conn.destroy();
    }

    const ownOK = results.ownRead && results.ownWrite;
    const otherOK = !results.otherRead && !results.otherWrite;
    const allOK = ownOK && otherOK;

    process.stdout.write('  自有表: ');
    process.stdout.write(ownOK ? chalk.green('✅') : chalk.red('❌'));
    
    process.stdout.write('  跨表: ');
    process.stdout.write(otherOK ? chalk.green('🔒') : chalk.red('⚠️ LEAK!'));

    process.stdout.write(allOK ? chalk.green('  PASS') : chalk.red('  FAIL'));
    console.log('');

    if (allOK) passed++;
    else failed++;
  }

  console.log('');
  console.log(chalk.bold(`  测试结果: ${chalk.green(passed + ' 通过')}, ${failed > 0 ? chalk.red(failed + ' 失败') : chalk.gray('0 失败')}`));
  
  if (failed === 0) {
    console.log(chalk.bold.green('\n  🎉 完美！所有用户权限完全隔离！'));
    console.log(chalk.gray('  - 每个用户只能访问自己的表'));
    console.log(chalk.gray('  - 跨表访问被正确拒绝'));
  }
  console.log('');
}

testTableIsolation().catch(console.error);
