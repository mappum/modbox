'use strict'

const test = require('tape')
const MemoryMeter = require('../src/memory-meter.js')
const { isPrimitive, getCost, IGNORE } = MemoryMeter

test('getCost', (t) => {
  t.test('string', (t) => {
    t.equal(getCost(''), 4)
    t.equal(getCost('1234'), 12)
    t.equal(getCost('12345'), 14)
    t.end()
  })

  t.test('primitives', (t) => {
    t.equal(getCost(123), 8)
    t.equal(getCost(NaN), 8)
    t.equal(getCost(null), 4)
    t.equal(getCost(undefined), 4)
    t.equal(getCost(true), 4)
    t.equal(getCost(false), 4)
    t.end()
  })

  t.test('array', (t) => {
    t.equal(getCost([]), 4)
    t.equal(getCost([ 1, 2, 3, 4 ]), 20)
    t.equal(getCost(new Array(10)), 44)
    t.end()
  })

  t.test('typed arrays', (t) => {
    t.equal(getCost(new Uint8Array()), 4)
    t.equal(getCost(new Uint8Array(10)), 14)
    t.equal(getCost(new Int8Array(10)), 14)
    t.equal(getCost(new Uint16Array(10)), 24)
    t.equal(getCost(new Int16Array(10)), 24)
    t.equal(getCost(new Uint32Array(10)), 44)
    t.equal(getCost(new Int32Array(10)), 44)
    t.equal(getCost(new Float32Array(10)), 44)
    t.end()
  })

  t.test('ArrayBuffer', (t) => {
    t.equal(getCost(new ArrayBuffer(10)), 14)
    t.end()
  })

  t.test('objects', (t) => {
    t.equal(getCost({}), 4)
    t.equal(getCost({
      a: 1,
      b: 2,
      c: 3
    }), 16)
    t.end()
  })

  t.test('exempted', (t) => {
    t.equal(getCost({
      [IGNORE]: true,
      a: 1,
      b: 2
    }), 0)
    t.end()
  })

  t.end()
})

test('isPrimitive', (t) => {
  t.equal(isPrimitive(123), true)
  t.equal(isPrimitive(NaN), true)
  t.equal(isPrimitive(''), true)
  t.equal(isPrimitive('foo'), true)
  t.equal(isPrimitive(true), true)
  t.equal(isPrimitive(false), true)
  t.equal(isPrimitive({}), false)
  t.equal(isPrimitive([]), false)
  t.equal(isPrimitive(new Uint8Array()), false)
  t.equal(isPrimitive(function () {}), false)
  t.equal(isPrimitive(() => {}), false)
  t.end()
})

test('MemoryMeter', (t) => {
  t.test('count primitives', (t) => {
    let meter = new MemoryMeter()
    meter.count('abc') // 10
    meter.count(123) // 8
    t.equal(meter.sum, 18)
    t.end()
  })

  t.test('only count non-primitives\' delta', (t) => {
    let array = [ 1, 2, 3 ]
    let meter = new MemoryMeter()
    meter.count(array)
    t.equal(meter.sum, 16)
    meter.count(array)
    t.equal(meter.sum, 16)
    array.push(4)
    meter.count(array)
    t.equal(meter.sum, 20)
    t.end()
  })

  t.end()
})
