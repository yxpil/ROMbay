const mysql = require('mysql2/promise');
const chalk = require('chalk');

const USERS = [
  { name: 'admin', pass: '请输入自己的密码' },
  { name: 'reader', pass: '请输入自己的密码' },
  { name: 'guest', pass: '请输入自己的密码' }
];

const PROXY = { host: '127.0.0.1', port: 3307 };

async function testPermissions() {
  console.log('');
  console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║') + chalk.bold.white('           PERMISSION TEST MATRIX                          ') + chalk.bold.blue('║'));
  console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════╝'));
  console.log('');

  for (const user of USERS) {
    console.log(chalk.bold.yellow(`\n=== Testing User: ${user.name} ===`));
    
    let conn;
    try {
      conn = await mysql.createConnection({
        ...PROXY,
        user: user.name,
        password: user.pass
      });

      const [tables] = await conn.query('SHOW TABLES FROM yxpil');
      const tableNames = tables.map(t => Object.values(t)[0]);
      
      console.log(chalk.gray(`  Found ${tableNames.length} tables in yxpil database\n`));

      for (const table of tableNames.slice(0, 15)) {
        process.stdout.write(`  ${chalk.cyan(table.padEnd(25))} | `);
        
        try {
          const [rows] = await conn.query(`SELECT COUNT(*) as c FROM yxpil.\`${table}\` LIMIT 1`);
          process.stdout.write(chalk.green('READ ✅  '));
        } catch(e) {
          process.stdout.write(chalk.red('READ ❌  '));
        }

        try {
          await conn.query(`UPDATE yxpil.\`${table}\` SET id = id WHERE 1=0`);
          process.stdout.write(chalk.green('WRITE ✅'));
        } catch(e) {
          process.stdout.write(chalk.red('WRITE ❌'));
        }
        console.log('');
      }

      if (tableNames.length > 15) {
        console.log(chalk.gray(`  ... and ${tableNames.length - 15} more tables`));
      }

    } catch(e) {
      console.log(chalk.red(`  Connection failed: ${e.message}`));
    } finally {
      if (conn) conn.destroy();
    }
  }

  console.log('');
  console.log(chalk.bold.green('✅ Test Complete!'));
  console.log('');
}

testPermissions().catch(console.error);
