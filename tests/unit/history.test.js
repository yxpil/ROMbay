'use strict';
/**
 * DidHistory 审计统计单元测试（关闭审计文件流，纯测逻辑）
 */
const test = require('node:test');
const assert = require('node:assert');
const DidHistory = require('../../src/DidHistory');

const h = new DidHistory({ ENABLE_AUDIT: false, CACHE_MAX_SIZE: 10 });

test('isReadOnly / isWrite 分类', () => {
  assert.strictEqual(h.isReadOnly('SELECT * FROM t'), true);
  assert.strictEqual(h.isReadOnly('  show tables  '), true);
  assert.strictEqual(h.isWrite('DELETE FROM t'), true);
  assert.strictEqual(h.isWrite('create table x (id int)'), true);
  assert.strictEqual(h.isReadOnly('DELETE FROM t'), false);
  assert.strictEqual(h.isWrite('SELECT 1'), false);
});

test('extractTable：从 from/into/update 提取表名并小写', () => {
  assert.strictEqual(h.extractTable('select * from Users'), 'users');
  assert.strictEqual(h.extractTable('insert into `Orders` values(1)'), 'orders');
  assert.strictEqual(h.extractTable('set @x=1'), null);
});

test('log() 累计统计：读/写/缓存命中/拒绝分别计数', () => {
  h.log('SELECT * FROM a', 1, false, '1.1.1.1', 'db', 'alice');   // read miss
  h.log('SELECT * FROM a', 1, true, '1.1.1.1', 'db', 'alice');    // read hit
  h.log('DELETE FROM a', 1, false, '1.1.1.1', 'db', 'alice');      // write
  h.log('SELECT * FROM b', 1, false, '1.1.1.1', 'db', 'bob', true); // denied
  assert.strictEqual(h.stats.totalQueries, 4);
  assert.strictEqual(h.stats.readQueries, 3);
  assert.strictEqual(h.stats.writeQueries, 1);
  assert.strictEqual(h.stats.cacheHits, 1);
  assert.strictEqual(h.stats.deniedQueries, 1);
});
