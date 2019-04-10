'use strict'

const test = require('tape')
const instrumentCode = require('../src/instrument.js')

test('instrumentation', (t) => {
  t.test('bracketless arrow function', (t) => {
    t.equal(
      instrumentCode('burn', '() => 123'),
      'burn(() => {\n  burn()\n  burn()\n  return burn(123);\n});'
    )
    t.end()
  })

  t.test('function', (t) => {
    t.equal(
      instrumentCode(
        'burn',
        `
          function f (x) {
            return x + x
          }
        `
      ),
      '\nfunction f(x) {\n  burn()\n\n  return burn(burn(x) + burn(x));\n}'
    )
    t.end()
  })

  t.test('UpdateExpression', (t) => {
    t.equal(
      instrumentCode('burn', 'x++'),
      'burn(x++);'
    )
    t.end()
  })

  t.test('MemberExpression', (t) => {
    t.equal(
      instrumentCode('burn', 'x.y.z = 5'),
      'burn(burn(burn(x).y).z = burn(5));'
    )
    t.end()
  })

  t.end()
})
