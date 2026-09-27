import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, toInt, toMoney, toIsoDate, toPhone, toBool, monthNumber } from '../src/domain/normalize.js';

test('clean', () => {
  assert.equal(clean(null), null);
  assert.equal(clean(undefined), null);
  assert.equal(clean('   '), null);
  assert.equal(clean('a\u00a0  b'), 'a b');
  assert.equal(clean(' hi '), 'hi');
  assert.equal(clean(42), '42');
});

test('toInt', () => {
  assert.equal(toInt(null), null);
  assert.equal(toInt(''), null);
  assert.equal(toInt(5.9), 5);
  assert.equal(toInt(NaN), null);
  assert.equal(toInt(Infinity), null);
  assert.equal(toInt('Rp 1.500'), 1500);
  assert.equal(toInt('-'), null);
  assert.equal(toInt('abc'), null);
});

test('toMoney', () => {
  assert.equal(toMoney(null), null);
  assert.equal(toMoney(''), null);
  assert.equal(toMoney(1234.6), 1235);
  assert.equal(toMoney(NaN), null);
  assert.equal(toMoney('Rp 2.500.000'), 2500000);
  assert.equal(toMoney('   '), null);
  assert.equal(toMoney('1,500,000'), 1500000);
  assert.equal(toMoney('1.500,25'), 1500);
  assert.equal(toMoney('12.2'), 12);
  assert.equal(toMoney('1,2'), 1);
  assert.equal(toMoney('abc'), null);
});

test('toIsoDate', () => {
  assert.equal(toIsoDate(null), null);
  assert.equal(toIsoDate(''), null);
  assert.equal(toIsoDate('   '), null);
  assert.equal(toIsoDate(new Date('2026-11-28T00:00:00Z')), '2026-11-28');
  assert.equal(toIsoDate(new Date('not-a-date')), null);
  assert.equal(toIsoDate('2026-11-28'), '2026-11-28');
  assert.equal(toIsoDate('28/11/2026'), '2026-11-28');
  assert.equal(toIsoDate('28-11-26'), '2026-11-28');
  assert.equal(toIsoDate('28 Nov 2026'), '2026-11-28');
  assert.equal(toIsoDate('28 Foo 2026'), null);
  assert.equal(toIsoDate('hello'), null);
});

test('monthNumber', () => {
  assert.equal(monthNumber('Nov'), 11);
  assert.equal(monthNumber('mei'), 5);
  assert.equal(monthNumber('Dec'), 12);
  assert.equal(monthNumber('Foo'), null);
  assert.equal(monthNumber(null), null);
});

test('toPhone', () => {
  assert.equal(toPhone(null), null);
  assert.equal(toPhone(''), null);
  assert.equal(toPhone('08123456789'), '+628123456789');
  assert.equal(toPhone('+62 812-3456-7890'), '+6281234567890');
  assert.equal(toPhone('812'), null);
  assert.equal(toPhone(12345), null);
});

test('toBool', () => {
  assert.equal(toBool(true), true);
  assert.equal(toBool(false), false);
  assert.equal(toBool(null), null);
  assert.equal(toBool('Ya'), true);
  assert.equal(toBool('no'), false);
  assert.equal(toBool('maybe'), null);
});
