const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TABLES = [
  "advertiser_ad_url", "advertiser_ban", "advertiser_bill", "advertiser_info", "advertiser_order",
  "ai_chat_message", "ai_chat_session", "ai_device_cmd_map", "ai_session_memory", "ai_user_memory",
  "ai_violation_detect", "at_blogs", "blogs", "chat_group", "chat_group_member", "chat_group_msg",
  "chat_single_msg", "comments", "device_token", "friend_relation", "iot_control_queue", "iot_device",
  "iot_device_log", "novel_bookshelf", "novel_chapter", "novel_comment_reward", "novel_info",
  "novel_payment", "novel_read_log", "novel_recharge_order", "pack", "reply", "sys_image",
  "sys_ip_access_log", "sys_ip_ban", "token", "token_account", "token_flow", "user", "user_account_ban",
  "user_api_call_log", "user_api_token", "user_avatar", "user_blacklist", "user_oauth_bind",
  "user_oauth_login_log", "user_plus", "video", "wol_bind_device", "wol_wake_queue"
];

const userDir = path.join(process.cwd(), 'Data', 'User');
const credentials = [];
const nameCounter = {};

console.log('Creating 50 unique table users...\n');

for (const table of TABLES) {
  const prefix = 'u_';
  const shortTable = table.length > 10 ? table.substring(0, 10) : table;
  
  let baseName = prefix + shortTable;
  if (nameCounter[baseName]) {
    nameCounter[baseName]++;
    baseName = prefix + shortTable + nameCounter[baseName];
  } else {
    nameCounter[baseName] = 1;
  }
  
  const username = baseName;
  const password = crypto.randomBytes(5).toString('hex');
  
  const config = {
    password: password,
    readTables: [`yxpil.${table}`],
    writeTables: [`yxpil.${table}`]
  };

  fs.writeFileSync(
    path.join(userDir, `${username}.json`),
    JSON.stringify(config, null, 2)
  );

  credentials.push({ username, password, table });
  console.log(`  ✅ ${username.padEnd(16)} : ${password} -> yxpil.${table}`);
}

fs.writeFileSync(
  path.join(process.cwd(), 'table_credentials.json'),
  JSON.stringify(credentials, null, 2)
);

console.log(`\n✅ Created ${credentials.length} unique table users!`);
console.log(`📄 Credentials saved to table_credentials.json`);
console.log('');
