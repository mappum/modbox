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
    consoleMode: opts.allowConsole ? 'allow' : false
  })

  // run prelude code inside realm
  let {
    module,
    functionConstructors,
    iteratedMethods,
    RegExp,
    stringRepeat
  } = realm.evaluate(prelude)

  let aborting = false
  let burnHandler = (value) => {
    // throw if a previous burn handler already errored
    // TODO: find better way to abort?
    if (aborting) throw Error('Execution failed')

    try {
      // ban use of function constructors
      // (otherwise an attacker could execute uninstrumented code)
      // also prevents shadowing the burn handler identifier, which would
      // allow instrumented code to not actually call the burn handler.
      // XXX: this prevents using the constructor's static methods
      // TODO: allow, but wrap to instrument code when called
      if (functionConstructors.has(value)) {
        throw Error('Function constructor is not allowed')
      }

      // ban regular expressions
      if (value instanceof RegExp) {
        throw Error('Regular expressions are not allowed')
      }

      // make sure iterated methods (Array#forEach, etc) call burn handler for each iteration
      if (iteratedMethods.has(value)) {
        let method = value
        value = function (func, ...args) {
          // wrap iteration function to call burn handler
          func = (...args) => burnHandler(func(...args))
          return method.call(this, ...args)
        }
      }

      // TODO: add burn handler call for other expensive built-ins
      //       (String#repeat, String#replace, etc.)

      // TODO: implement a gasLimit option?
      if (opts.onBurn) {
        opts.onBurn(value)
      }

      let memoryUsage = memoryMeter.count(value)
      if (memoryUsage > opts.memoryLimit) {
        throw Error('Exceeded memory limit')
      }

      return value
    } catch (err) {
      aborting = true
      // TODO: also revoke membrane proxies?
    }
  }

  // run consumer's module code,
  // which has been instrumented so that it calls
  // out to the burn handler as it executes
  let burnId = getBurnIdentifier(code)
  let instrumented = instrumentCode(burnId, code)
  realm.evaluate(instrumented, {
    // consumer-supplied globals
    ...protect.internal(opts.globals),

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
