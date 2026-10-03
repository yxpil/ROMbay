'use strict';
/**
 * LinkUPsql 单元测试 —— 缓存 key 归一化、长度编码、结果集包构造。
 * 裸实例，不建立真实 MySQL 连接。
 */
const test = require('node:test');
const assert = require('node:assert');
const LinkUPsql = require('../../src/LinkUPsql');

const up = Object.create(LinkUPsql.prototype);

test('genKey：空白/大小写归一化，db 前缀不同 key 不同', () => {
  const k1 = up.genKey('SELECT  *  FROM t', 'db1');
  const k2 = up.genKey('select * from t', 'db1');
  assert.strictEqual(k1, k2, '大小写与多余空白应归一为同一 key');
  assert.notStrictEqual(up.genKey('select * from t', 'db2'), k1);
});

test('writeLenCoded：三档长度前缀', () => {
  assert.deepStrictEqual([...up.writeLenCoded(0)], [0]);
  assert.deepStrictEqual([...up.writeLenCoded(250)], [250]);
  const mid = up.writeLenCoded(500);
  assert.strictEqual(mid[0], 0xfc);
  assert.strictEqual(mid.readUInt16LE(1), 500);
  const big = up.writeLenCoded(70000);
  assert.strictEqual(big[0], 0xfd);
  assert.strictEqual(big.readUIntLE(1, 3), 70000);
});

test('resultToPackets：空 fields 返回 OK 包；有 fields 生成列定义与 EOF', () => {
  const okOnly = up.resultToPackets([], [], 0);
  assert.strictEqual(okOnly.length, 1);
  assert.strictEqual(okOnly[0][4], 0x00, '无结果集应为 OK 包(首字节 0x00)');

  const rows = up.resultToPackets([{ name: 'alice' }, { name: 'bob' }], [{ name: 'name' }], 0);
  // 列计数包 + 1 列定义 + EOF + 2 行 + EOF
  assert.strictEqual(rows.length, 6);
});
