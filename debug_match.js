const LinkVMUser = require('./src/LinkVMUser');
const ReadConfig = require('./src/ReadConfig');

const CONFIG = new ReadConfig().get();
const vmUser = new LinkVMUser(CONFIG);

console.log('=== DEBUG TABLE MATCH ===\n');

const sqls = [
  'SELECT * FROM yxpil.users',
  'UPDATE yxpil.users SET id=1',
  'SELECT * FROM users',
  'SELECT 1 FROM yxpil.blogs WHERE id=1'
];

for (const sql of sqls) {
  console.log(`SQL: ${sql}`);
  const tables = vmUser.extractTables(sql);
  console.log(`  Extracted tables: ${tables.join(', ')}`);
  
  for (const table of tables) {
    const patterns = ['yxpil.*', '*'];
    for (const pat of patterns) {
      const matched = 
        pat === '*' || 
        pat === table ||
        (pat.endsWith('.*') && table.startsWith(pat.slice(0, -1)));
      console.log(`    ${table} ~= ${pat} ? ${matched}`);
      console.log(`       slice: '${pat.slice(0, -1)}' startsWith: ${table.startsWith(pat.slice(0, -1))}`);
    }
  }
  console.log('');
}

console.log('\n=== User config ===');
for (const [name, u] of Object.entries(vmUser.users)) {
  console.log(`\n${name}:`);
  console.log(`  readTables: ${u.readTables.join(', ')}`);
  console.log(`  writeTables: ${u.writeTables.join(', ')}`);
}
