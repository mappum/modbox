'use strict'

const createHash = require('create-hash')
const { makeSESRootRealm } = require('ses')
const instrumentCode = require('./instrument.js')
const prelude = require('./prelude.js')
const protect = require('./protect.js')
const MemoryMeter = require('./memory-meter.js')

function createModule (code, opts = {}) {
  // TODO: ensure args are valid

  // TODO: find good default
  opts.memoryLimit = opts.memoryLimit || 10e6

  let memoryMeter = new MemoryMeter()
  let realm = makeSESRootRealm({
    consoleMode: 'allow'
  })

  // run prelude code inside realm, giving us the
  // `module` object
  let {
    module,
    RegExp
  } = realm.evaluate(prelude)

  let burnHandler = (value) => {
    // ban regular expressions
    if (value instanceof RegExp) {
      throw Error('Regular expressions are not allowed')
    }

    // TODO: implement a gasLimit option?
    if (opts.onBurn) {
      opts.onBurn(value)
    }

    let memoryUsage = memoryMeter.count(value)
    if (memoryUsage > opts.memoryLimit) {
      throw Error('Exceeded memory limit')
    }

    return value
  }

  // run consumer's module code,
  // which has been instrumented so that it calls
  // out to the burn handler as it executes
  let burnId = getBurnIdentifier(code)
  let instrumented = instrumentCode(burnId, code)
  realm.evaluate(instrumented, {
    // consumer-supplied globals
    ...protect.internal(opts.global),

    [burnId]: burnHandler,
    module,

    // blacklisted globals
    JSON: undefined,
    RegExp: undefined,
    SES: undefined
  })

  return protect.external(module.exports)
}

function getBurnIdentifier (code) {
  return `burn_${sha256(code)}`
}

function sha256 (data) {
  return createHash('sha256').update(data).digest('hex')
}

module.exports = createModule