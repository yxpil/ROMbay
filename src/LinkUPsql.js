const mysql = require('mysql2/promise');
const { LRUCache } = require('lru-cache');
const crypto = require('crypto');

class LinkUPsql {
  constructor(config) {
    this.config = config;
    this.pool = mysql.createPool({
      host: config.MASTER_DB.host,
      port: config.MASTER_DB.port,
      user: config.MASTER_DB.user,
      password: config.MASTER_DB.password,
      connectionLimit: 100,
      timezone: '+08:00'
    });
    this.cache = new LRUCache({
      max: config.CACHE_MAX_SIZE,
      ttl: config.CACHE_TTL
    });
  }

  async query(sql, db = '') {
    const isRead = this.isReadOnly(sql);
    const cacheKey = isRead ? this.genKey(sql, db) : null;

    if (isRead && this.config.ENABLE_CACHE) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { results: cached.results, fields: cached.fields, fromCache: true, duration: 1 };
      }
    }

    const start = Date.now();
    const conn = await this.pool.getConnection();
    if (db) await conn.query('USE ??', [db]).catch(() => {});
    
    try {
      const [results, fields] = await conn.query(sql);
      conn.release();
      const duration = Date.now() - start;

      if (this.config.CACHE_INVALIDATE_ON_WRITE && this.isWrite(sql)) {
        const tbl = this.extractTable(sql);
        if (tbl) this.clearCacheByTable(tbl);
      }

      if (isRead && this.config.ENABLE_CACHE) {
        this.cache.set(cacheKey, { results, fields });
      }

      return { results, fields, fromCache: false, duration };
    } catch (e) {
      conn.release();
      throw e;
    }
  }

  genKey(sql, db) {
    const norm = sql.trim().replace(/\s+/g, ' ').toLowerCase();
    return crypto.createHash('md5').update(db + ':' + norm).digest('hex');
  }

  isReadOnly(sql) {
    const s = sql.trim().toLowerCase();
    return /^(select|show|describe|explain|set)\s/.test(s);
  }

  isWrite(sql) {
    const s = sql.trim().toLowerCase();
    return /^(insert|update|delete|drop|alter|create|truncate|replace|rename)\s/.test(s);
  }

  extractTable(sql) {
    const m = sql.match(/(?:from|into|update|table)\s+`?(\w+)`?/i);
    return m ? m[1].toLowerCase() : null;
  }

  clearCacheByTable(table) {
    let cnt = 0;
    this.cache.forEach((v, k) => {
      if (v.sql && v.sql.toLowerCase().includes(table)) {
        this.cache.delete(k);
        cnt++;
      }
    });
    return cnt;
  }

  getCacheSize() {
    return this.cache.size;
  }

  clearCache() {
    this.cache.clear();
  }

  writeLenCoded(len) {
    if (len < 251) {
      return Buffer.from([len]);
    } else if (len < 65536) {
      const b = Buffer.alloc(3);
      b[0] = 0xfc;
      b.writeUInt16LE(len, 1);
      return b;
    } else if (len < 16777216) {
      const b = Buffer.alloc(4);
      b[0] = 0xfd;
      b.writeUIntLE(len, 1, 3);
      return b;
    } else {
      const b = Buffer.alloc(9);
      b[0] = 0xfe;
      b.writeBigUInt64LE(BigInt(len), 1);
      return b;
    }
  }

  resultToPackets(results, fields, seqId) {
    const packets = [];
    let seq = seqId;

    if (!fields || fields.length === 0) {
      packets.push(this.buildPacket(seq++, Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00])));
      return packets;
    }

    packets.push(this.buildPacket(seq++, Buffer.from([fields.length])));

    for (const f of fields) {
      packets.push(this.buildPacket(seq++, this.buildField(f)));
    }

    packets.push(this.buildPacket(seq++, Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00])));

    for (const row of results) {
      const bufs = [];
      for (const v of Object.values(row)) {
        if (v === null) {
          bufs.push(Buffer.from([0xfb]));
        } else {
          const s = String(v);
          bufs.push(this.writeLenCoded(s.length), Buffer.from(s));
        }
      }
      packets.push(this.buildPacket(seq++, Buffer.concat(bufs)));
    }

    packets.push(this.buildPacket(seq++, Buffer.from([0xfe, 0, 0, 2, 0])));
    return packets;
  }

  buildField(f) {
    const catalog = Buffer.from('def');
    const schema = Buffer.from(f.schema || '');
    const table = Buffer.from(f.table || '');
    const orgTable = Buffer.from(f.orgTable || f.table || '');
    const name = Buffer.from(f.name);
    const orgName = Buffer.from(f.orgName || f.name || '');
    
    const totalLen = 9 + catalog.length + schema.length + table.length + 
                     orgTable.length + name.length + orgName.length;
    const payload = Buffer.alloc(totalLen + 32);
    let o = 0;

    const len = (v) => this.writeLenCoded(v);
    const writeStr = (s) => {
      len(s.length).copy(payload, o);
      o += len(s.length).length;
      s.copy(payload, o);
      o += s.length;
    };

    writeStr(catalog);
    writeStr(schema);
    writeStr(table);
    writeStr(orgTable);
    writeStr(name);
    writeStr(orgName);

    payload[o++] = 12;
    payload.writeUInt16LE(f.characterSet || 33, o); o += 2;
    payload.writeUInt32LE(f.columnLength || 196605, o); o += 4;
    payload[o++] = f.columnType || f.type || 253;
    payload.writeUInt16LE(f.flags || 0, o); o += 2;
    payload[o++] = f.decimals ?? 31;
    payload.writeUInt16LE(0, o); o += 2;

    return payload.subarray(0, o);
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

module.exports = LinkUPsql;
