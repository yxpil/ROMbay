const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LinkVMUser {
  constructor(config) {
    this.config = config;
    this.dataDir = path.join(process.cwd(), 'Data', 'User');
    this.users = {};
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.loadUsers();
    
    if (Object.keys(this.users).length === 0) {
      this.initDefaultUsers();
      this.loadUsers();
    }
  }

  initDefaultUsers() {
    const defaults = {
      admin: {
        password: '请输入自己的密码',
        readTables: ['*'],
        writeTables: ['*']
      },
      reader: {
        password: '请输入自己的密码',
        readTables: ['yxpil.*', 'information_schema.*'],
        writeTables: []
      },
      guest: {
        password: '请输入自己的密码',
        readTables: ['yxpil.ai_chat_message', 'yxpil.blogs'],
        writeTables: []
      }
    };

    for (const [name, cfg] of Object.entries(defaults)) {
      fs.writeFileSync(
        path.join(this.dataDir, `${name}.json`),
        JSON.stringify(cfg, null, 2)
      );
    }
  }

  loadUsers() {
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const name = path.basename(file, '.json');
      try {
        this.users[name] = JSON.parse(
          fs.readFileSync(path.join(this.dataDir, file), 'utf8')
        );
      } catch (e) {}
    }
  }

  getUser(username) {
    return this.users[username];
  }

  exists(username) {
    return !!this.users[username];
  }

  verifyPassword(clientHash, password, scramble) {
    if (!password) return clientHash.length === 0;
    const s1 = crypto.createHash('sha1').update(password).digest();
    const s2 = crypto.createHash('sha1').update(s1).digest();
    const scrambleClean = Buffer.concat([scramble.subarray(0, 8), scramble.subarray(9, 21)]);
    const s3 = crypto.createHash('sha1').update(Buffer.concat([scrambleClean, s2])).digest();
    for (let i = 0; i < 20; i++) s3[i] ^= s1[i];
    
    return s3.equals(clientHash);
  }

  checkPermission(sql, username) {
    const user = this.getUser(username);
    if (!user) return false;

    const s = sql.trim().toLowerCase();

    if (/^(show|set|select\s+@@|explain|describe|desc)\s/.test(s)) {
      return true;
    }

    const isWriteOp = /^(insert|update|delete|drop|alter|create|truncate|replace|rename)\s/i.test(s);
    const tables = this.extractTables(sql);

    const allowedList = isWriteOp ? (user.writeTables || []) : (user.readTables || []);

    if (allowedList.includes('*')) return true;

    for (const table of tables) {
      const matched = allowedList.some(pat => 
        pat === '*' || 
        pat === table ||
        (pat.endsWith('.*') && table.startsWith(pat.slice(0, -1)))
      );
      if (!matched) return false;
    }

    return true;
  }

  extractTables(sql) {
    const s = sql.toLowerCase().replace(/`/g, '');
    const tables = [];
    const patterns = [
      /from\s+([\w.]+)(?:\s|,|$)/gi,
      /join\s+([\w.]+)(?:\s|,|$)/gi,
      /into\s+([\w.]+)(?:\s|,|$)/gi,
      /update\s+([\w.]+)(?:\s|,|$)/gi,
      /table\s+([\w.]+)(?:\s|,|$)/gi
    ];

    for (const re of patterns) {
      let m;
      while ((m = re.exec(s)) !== null) {
        if (!tables.includes(m[1])) tables.push(m[1]);
      }
    }

    return tables;
  }

  getScramble() {
    return Buffer.concat([
      Buffer.from('ABCDEFGH'),
      Buffer.from([0]),
      Buffer.from('IJKLMNOPQRST')
    ]);
  }

  buildHandshake(seqId) {
    const plugin = Buffer.from('mysql_native_password');
    const scramble = this.getScramble();
    const payload = Buffer.alloc(128);
    
    // 正确的 MySQL 握手包格式
    let offset = 0;
    payload[offset++] = 0x0a;                     // protocol version = 10
    
    Buffer.from('5.7.00').copy(payload, offset);  // server version
    offset += 6;
    payload[offset++] = 0;                        // null terminator
    
    payload.writeUInt32LE(0x00000001, offset);    // connection ID
    offset += 4;
    
    scramble.copy(payload, offset, 0, 8);         // auth-plugin-data-part-1 (8 bytes)
    offset += 8;
    
    payload[offset++] = 0;                        // filler
    
    payload.writeUInt16LE(0xfff7, offset);        // capability flags (lower 2 bytes)
    offset += 2;
    
    payload[offset++] = 33;                       // character set (utf8_general_ci)
    
    payload.writeUInt16LE(0x0002, offset);        // status flags
    offset += 2;
    
    payload.writeUInt16LE(0x0000, offset);        // capability flags (upper 2 bytes) - 关闭 PLUGIN_AUTH
    offset += 2;
    
    payload[offset++] = 21;                       // auth plugin data length
    
    payload.fill(0, offset, offset + 10);         // reserved (10 bytes)
    offset += 10;
    
    scramble.copy(payload, offset, 9);            // auth-plugin-data-part-2 (12 bytes)
    offset += 12;
    
    payload[offset++] = 0;                        // filler
    
    plugin.copy(payload, offset);                 // auth plugin name
    offset += plugin.length;
    payload[offset++] = 0;                        // null terminator
    
    const finalPayload = payload.subarray(0, offset);
    return { scramble, packet: this.buildPacket(seqId, finalPayload) };
  }

  buildPacket(sequenceId, payload) {
    const buf = Buffer.alloc(4 + payload.length);
    buf.writeUIntLE(payload.length, 0, 3);
    buf[3] = sequenceId;
    payload.copy(buf, 4);
    return buf;
  }

  buildOK(sequenceId) {
    return this.buildPacket(sequenceId, Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]));
  }

  buildError(sequenceId, code, msg) {
    const mbuf = Buffer.from(msg);
    const payload = Buffer.alloc(9 + mbuf.length);
    payload[0] = 0xff;
    payload.writeUInt16LE(code, 1);
    payload[3] = 0x23;
    Buffer.from('HY000').copy(payload, 4);
    mbuf.copy(payload, 9);
    return this.buildPacket(sequenceId, payload);
  }
}

module.exports = LinkVMUser;
