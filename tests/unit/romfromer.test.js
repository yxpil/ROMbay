'use strict';
/**
 * RomFromer MySQL 包解析单元测试（裸实例，不监听端口）
 */
const test = require('node:test');
const assert = require('node:assert');
const RomFromer = require('../../src/RomFromer');

const rf = Object.create(RomFromer.prototype);

function buildPacket(length, seq, payload, extra) {
  const head = Buffer.alloc(4);
  head.writeUIntLE(length, 0, 3);
  head[3] = seq;
  return Buffer.concat([head, payload, extra || Buffer.alloc(0)]);
}

test('readPacket：完整包正确切分长度/序号/payload/remaining', () => {
  const payload = Buffer.from('hello');
  const buf = buildPacket(payload.length, 1, payload, Buffer.from('REMAIN'));
  const pkt = rf.readPacket(buf);
  assert.strictEqual(pkt.length, 5);
  assert.strictEqual(pkt.sequenceId, 1);
  assert.strictEqual(pkt.payload.toString(), 'hello');
  assert.strictEqual(pkt.remaining.toString(), 'REMAIN');
});

test('readPacket：短包/半包返回 null（粘包处理边界）', () => {
  assert.strictEqual(rf.readPacket(Buffer.from([1, 2])), null, '<4 字节');
  // 声明长度 10 但只有 4 字节头
  const half = buildPacket(10, 0, Buffer.from('ab'));
  assert.strictEqual(rf.readPacket(half), null, '声明长度超过实际数据应返回 null');
});
