const mysql = require('mysql2/promise');

const PROXY = { host: '127.0.0.1', port: 3307 };

async function debug() {
  console.log('=== DEBUG REAL CONNECTION ===\n');

  console.log('1. Test admin user (should have full access):');
  try {
    const conn = await mysql.createConnection({
      ...PROXY,
      user: 'admin',
      password: '请输入自己的密码'
    });
    console.log('   ✅ Admin connected!');
    
    const [rows] = await conn.query('SELECT 1 as test FROM yxpil.blogs LIMIT 1');
    console.log('   ✅ Admin SELECT blogs ok');
    
    await conn.query('UPDATE yxpil.blogs SET id = id WHERE 1=0');
    console.log('   ✅ Admin UPDATE blogs ok');
    conn.destroy();
  } catch(e) {
    console.log('   ❌ Error:', e.message);
  }

  console.log('\n2. Test u_blogs user:');
  try {
    const conn = await mysql.createConnection({
      ...PROXY,
      user: 'u_blogs',
      password: '请输入自己的密码'
    });
    console.log('   ✅ u_blogs connected!');
    
    try {
      const [rows] = await conn.query('SELECT 1 as test FROM yxpil.blogs LIMIT 1');
      console.log('   ✅ SELECT blogs ok');
    } catch(e) {
      console.log('   ❌ SELECT blogs:', e.message);
    }

    try {
      const [rows] = await conn.query('SELECT 1 as test FROM yxpil.user LIMIT 1');
      console.log('   ⚠️  LEAK! Should not access user!');
    } catch(e) {
      console.log('   🔒 Correctly denied access to user table');
    }

    conn.destroy();
  } catch(e) {
    console.log('   ❌ Connection failed:', e.message);
  }

  console.log('\n=== DONE ===');
}

debug().catch(console.error);


