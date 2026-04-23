const LinkVMUser = require('./src/LinkVMUser');
const ReadConfig = require('./src/ReadConfig');

const CONFIG = new ReadConfig().get();
const vmUser = new LinkVMUser(CONFIG);

console.log('=== DEBUG checkPermission ===\n');

const tests = [
  { user: 'reader', sql: 'SELECT * FROM yxpil.users' },
  { user: 'admin', sql: 'UPDATE yxpil.users SET id = id WHERE 1=0' },
  { user: 'admin', sql: 'UPDATE yxpil.ai_chat_message SET id = 1' },
];

for (const t of tests) {
  const user = vmUser.getUser(t.user);
  console.log(`User: ${t.user}`);
  console.log(`SQL: ${t.sql}`);
  
  const s = t.sql.trim().toLowerCase();
  const isWriteOp = /^(insert|update|delete|drop|alter|create|truncate|replace|rename)\s/i.test(s);
  console.log(`  isWriteOp: ${isWriteOp}`);
  
  const tables = vmUser.extractTables(t.sql);
  console.log(`  tables: ${tables.join(', ')}`);
  
  const allowedList = isWriteOp ? (user.writeTables || []) : (user.readTables || []);
  console.log(`  allowedList: ${allowedList.join(', ')}`);
  console.log(`  has *: ${allowedList.includes('*')}`);
  
  const result = vmUser.checkPermission(t.sql, t.user);
  console.log(`  checkPermission: ${result}`);
  console.log('');
}
