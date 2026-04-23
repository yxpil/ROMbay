const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const credentials = require('./table_credentials.json');

const credDir = path.join(process.cwd(), '部门账号');

if (!fs.existsSync(credDir)) {
  fs.mkdirSync(credDir, { recursive: true });
}

async function getTableSchema(tableName) {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'admin',
    password: '请输入自己的密码'
  });
  
  const [rows] = await conn.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'yxpil' AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, [tableName]);
  
  conn.destroy();
  return rows;
}

async function main() {
  console.log('查询表结构并创建账号文件...\n');

  for (const cred of credentials) {
    process.stdout.write(`  ${cred.username}... `);
    
    const schema = await getTableSchema(cred.table);
    
    const schemaText = schema.map(col => {
      const key = col.COLUMN_KEY === 'PRI' ? ' 🔑' : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const comment = col.COLUMN_COMMENT ? ` -- ${col.COLUMN_COMMENT}` : '';
      return `  ${col.COLUMN_NAME.padEnd(25)} ${col.DATA_TYPE.padEnd(12)} ${nullable.padEnd(8)}${key}${comment}`;
    }).join('\n');

    const content = `=====================================
部门数据库账号
=====================================

【基本信息】
  表名:   ${cred.table}
  用户:   ${cred.username}
  密码:   ${cred.password}
  端口:   3307
  主机:   127.0.0.1

【权限说明】
  可读:   yxpil.${cred.table}
  可写:   yxpil.${cred.table}

【连接示例】
  mysql -h 127.0.0.1 -P 3307 -u ${cred.username} -p${cred.password}

=====================================
【表结构】 yxpil.${cred.table}
=====================================
${schemaText}

=====================================
`;

    fs.writeFileSync(
      path.join(credDir, `${cred.username}_${cred.table}.txt`),
      content
    );

    console.log(`✅ (${schema.length} 个字段)`);
  }

  let summary = `=====================================
      50 张表账号总览
=====================================

代理端口: 3307
代理主机: 127.0.0.1

共计 ${credentials.length} 个独立账号

=====================================
账号列表:
`;

  for (const c of credentials) {
    const schema = await getTableSchema(c.table);
    summary += `\n  [${c.username.padEnd(18)}] -> yxpil.${c.table.padEnd(22)} (${schema.length} 字段)`;
  }

  fs.writeFileSync(path.join(credDir, '0_账号总览.txt'), summary);

  console.log(`\n✅ 已创建 ${credentials.length + 1} 个账号文件`);
  console.log(`📂 目录: ${credDir}`);
  console.log('');
}

main().catch(console.error);


