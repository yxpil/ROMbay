'use strict';
/**
 * LinkVMUser 单元测试 —— 表级权限校验、SQL 表提取、native 密码校验、握手/包构造。
 * 用 Object.create 绕过构造函数（避免写 Data/User 目录），直接注入 users。
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const LinkVMUser = require('../../src/LinkVMUser');

function mk(users) {
  const v = Object.create(LinkVMUser.prototype);
  v.users = users || {};
  return v;
}

const vm = mk({
  admin: { readTables: ['*'], writeTables: ['*'] },
  guest: { readTables: ['yxpil.blogs', 'yxpil.ai_chat_message'], writeTables: [] },
  reader: { readTables: ['yxpil.*'], writeTables: [] }
});

test('checkPermission：管理账号全通；guest 只能访问授权表', () => {
  assert.strictEqual(vm.checkPermission('SELECT * FROM anytable', 'admin'), true);
  assert.strictEqual(vm.checkPermission('SELECT * FROM yxpil.blogs', 'guest'), true);
  assert.strictEqual(vm.checkPermission('SELECT * FROM yxpil.secret', 'guest'), false, '未授权表必须拒绝');
  assert.strictEqual(vm.checkPermission('SELECT * FROM other.t', 'guest'), false);
});

test('注入防护：guest 不能写任何表；reader 可读 yxpil.*', () => {
  assert.strictEqual(vm.checkPermission('INSERT INTO yxpil.blogs VALUES(1)', 'guest'), false, '只读用户写操作必须拒绝');
  assert.strictEqual(vm.checkPermission('DELETE FROM yxpil.blogs', 'guest'), false);
  assert.strictEqual(vm.checkPermission('SELECT * FROM yxpil.anything', 'reader'), true, '通配 yxpil.* 应匹配');
  assert.strictEqual(vm.checkPermission('SELECT * FROM other.t', 'reader'), false);
});

test('show/explain/set 等元查询对所有用户放行', () => {
  assert.strictEqual(vm.checkPermission('show tables', 'guest'), true);
  assert.strictEqual(vm.checkPermission('explain select 1', 'guest'), true);
  assert.strictEqual(vm.checkPermission('select @@version', 'guest'), true);
  assert.strictEqual(vm.checkPermission('SELECT * FROM yxpil.blogs', 'nobody'), false, '未知用户拒绝');
});

test('extractTables：from/join/into/update 提取，去反引号', () => {
  assert.deepStrictEqual(vm.extractTables('SELECT a.x FROM yxpil.blogs a JOIN yxpil.users b ON a.id=b.id'), ['yxpil.blogs', 'yxpil.users']);
  assert.deepStrictEqual(vm.extractTables('insert into `yxpil.blogs` values(1)'), ['yxpil.blogs']);
});

test('verifyPassword：正确密码通过，篡改/错误密码拒绝', () => {
  const scramble = vm.getScramble();
  const pw = 's3cret';
  const s1 = crypto.createHash('sha1').update(pw).digest();
  const s2 = crypto.createHash('sha1').update(s1).digest();
  const clean = Buffer.concat([scramble.subarray(0, 8), scramble.subarray(9, 21)]);
  let s3 = crypto.createHash('sha1').update(Buffer.concat([clean, s2])).digest();
  for (let i = 0; i < 20; i++) s3[i] ^= s1[i];
  assert.strictEqual(vm.verifyPassword(s3, pw, scramble), true, '正确 hash 应通过');
  const bad = Buffer.from(s3); bad[0] ^= 0xff;
  assert.strictEqual(vm.verifyPassword(bad, pw, scramble), false, '篡改 hash 必须拒绝');
  assert.strictEqual(vm.verifyPassword(s3, 'wrong', scramble), false, '错误密码必须拒绝');
});

test('buildPacket / buildError 包格式', () => {
  const pkt = vm.buildPacket(3, Buffer.from([0x01, 0x02]));
  assert.strictEqual(pkt.readUIntLE(0, 3), 2);
  assert.strictEqual(pkt[3], 3);
  const err = vm.buildError(1, 1045, 'Access denied');
  assert.strictEqual(err[4], 0xff, 'ERR 包首字节应为 0xff');
});
