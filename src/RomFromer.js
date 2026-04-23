const net = require('net');
const chalk = require('chalk');

class RomFromer {
  constructor(config, vmUser, upSql, history) {
    this.config = config;
    this.vmUser = vmUser;
    this.upSql = upSql;
    this.history = history;
    this.server = null;
  }

  readPacket(buffer) {
    if (buffer.length < 4) return null;
    const length = buffer.readUIntLE(0, 3);
    const sequenceId = buffer[3];
    if (buffer.length < 4 + length) return null;
    return {
      length,
      sequenceId,
      payload: buffer.subarray(4, 4 + length),
      raw: buffer.subarray(0, 4 + length),
      remaining: buffer.subarray(4 + length)
    };
  }

  parseUsername(packet) {
    const p = packet.payload;
    let offset = 0;
    if (p[0] === 0x11) offset = 1;
    else offset = 4;
    
    offset += 4 + 4 + 1 + 23;
    if (offset >= p.length) return '';
    const nullPos = p.indexOf(0, offset);
    if (nullPos === -1) return p.subarray(offset).toString();
    return p.subarray(offset, nullPos).toString();
  }

  parsePasswordHash(packet) {
    const p = packet.payload;
    let offset = 0;
    if (p[0] === 0x11) offset = 1;
    else offset = 4;
    
    const clientFlags = p.readUInt32LE(offset);
    offset += 4 + 4 + 1 + 23;
    
    if (offset >= p.length) return Buffer.alloc(0);
    const nullPos = p.indexOf(0, offset);
    offset = (nullPos === -1 ? p.length : nullPos) + 1;
    if (offset >= p.length) return Buffer.alloc(0);
    const passLen = clientFlags & 0x00800000 ? p.readUInt8(offset++) : p[offset++];
    if (offset + passLen > p.length) return p.subarray(offset);
    return p.subarray(offset, offset + passLen);
  }

  start(port) {
    this.server = net.createServer((sock) => {
      this.history.stats.connections++;
      const clientIp = sock.remoteAddress.replace('::ffff:', '');
      let user = '';
      let db = '';
      let authOK = false;
      let authScramble = null;
      let buf = Buffer.alloc(0);
      let upstream = null;

      if (this.config.ENABLE_VIRTUAL_AUTH) {
        const hs = this.vmUser.buildHandshake(0);
        authScramble = hs.scramble;
        sock.write(hs.packet);
      } else {
        upstream = net.connect({
          host: this.config.MASTER_DB.host,
          port: this.config.MASTER_DB.port
        });
        upstream.on('data', (d) => sock.write(d));
        upstream.on('close', () => sock.destroy());
        upstream.on('error', () => sock.destroy());
        upstream.on('connect', () => {});
      }

      sock.on('data', async (data) => {
        if (!this.config.ENABLE_VIRTUAL_AUTH) {
          upstream.write(data);
          return;
        }
        buf = Buffer.concat([buf, data]);
        let pkt;
        while ((pkt = this.readPacket(buf))) {
          buf = pkt.remaining;

          if (!authOK) {
            try {
              const p = pkt.payload;
              let offset = 0;
              
              const clientFlags = p.readUInt32LE(offset);
              offset += 4 + 4 + 1 + 23;
              const nullPos = p.indexOf(0, offset);
              user = p.subarray(offset, nullPos).toString();
              offset = nullPos + 1;
              
              const passLen = clientFlags & 0x00800000 ? p.readUInt8(offset++) : p[offset++];
              const passHash = p.subarray(offset, offset + passLen);
              
              const cfg = this.vmUser.getUser(user);
              if (cfg && this.vmUser.verifyPassword(passHash, cfg.password, authScramble)) {
                authOK = true;
                console.log(chalk.green('[AUTH OK] ') + chalk.yellow(user) + chalk.gray(`@${clientIp}`));
                sock.write(this.upSql.buildOK(pkt.sequenceId + 1));
              } else {
                sock.write(this.vmUser.buildError(pkt.sequenceId + 1, 1045, `Access denied for '${user}'`));
                console.log(chalk.red('[AUTH FAIL] ') + chalk.yellow(user) + chalk.gray(`@${clientIp}`));
              }
            } catch (e) {
              sock.write(this.vmUser.buildError(pkt.sequenceId + 1, 1045, 'Auth error'));
            }
            continue;
          }

          const cmd = pkt.payload[0];

          if (cmd === 0x01) {
            sock.destroy();
            continue;
          }

          if (cmd === 0x03) {
            const sql = pkt.payload.subarray(1).toString();
            const sqlNorm = sql.toLowerCase().replace(/\s+/g, ' ').trim();

            if (sqlNorm.includes('information_schema.aggregate_functions')) {
              const fields = [{name: 'TABLE_CAT'}, {name: 'TABLE_SCHEM'}, {name: 'TABLE_NAME'}, 
                {name: 'COLUMN_NAME'}, {name: 'TYPE_NAME'}, {name: 'DATA_TYPE'}, {name: 'PRECISION'}];
              const packets = this.upSql.resultToPackets([], fields, pkt.sequenceId + 1);
              for (const p of packets) sock.write(p);
              continue;
            }

            if (sqlNorm.includes('specific_schema') && sqlNorm.includes('union')) {
              const fields = [
                {name: 'FUNCTION_CAT'}, {name: 'FUNCTION_SCHEM'}, {name: 'FUNCTION_NAME'},
                {name: 'REMARKS'}, {name: 'FUNCTION_TYPE'}, {name: 'SPECIFIC_NAME'}
              ];
              const packets = this.upSql.resultToPackets([], fields, pkt.sequenceId + 1);
              for (const p of packets) sock.write(p);
              continue;
            }

            if (this.config.ENABLE_VIRTUAL_AUTH && !this.vmUser.checkPermission(sql, user)) {
              this.history.log(sql, 0, false, clientIp, db, user, true);
              sock.write(this.upSql.buildError(pkt.sequenceId + 1, 1142, 'Denied'));
              console.log(chalk.red('[DENIED] ') + chalk.yellow(user) + chalk.gray(': ' + sql.substring(0, Math.min(50, sql.length))));
              continue;
            }

            try {
              const { results, fields, fromCache, duration } = await this.upSql.query(sql, db);
              this.history.log(sql, duration, fromCache, clientIp, db, user);
              const packets = this.upSql.resultToPackets(results, fields, pkt.sequenceId + 1);
              for (const p of packets) sock.write(p);
            } catch (e) {
              sock.write(this.upSql.buildError(pkt.sequenceId + 1, e.errno || 1064, e.message));
            }
            continue;
          }

          sock.write(this.upSql.buildOK(pkt.sequenceId + 1));
        }
      });

      sock.on('close', () => {
        this.history.stats.connections = Math.max(0, this.history.stats.connections - 1);
      });
      sock.on('error', () => {});
    });

    this.server.listen(port);
  }
}

module.exports = RomFromer;
