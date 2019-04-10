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
  opts.computeLimit = opts.computeLimit || 10e6
  opts.memoryLimit = opts.memoryLimit || 10e6
  opts.globals = opts.globals || {}

  let memoryMeter = new MemoryMeter()
  let realm = makeSESRootRealm({
    consoleMode: opts.allowConsole ? 'allow' : false
  })

  // run prelude code inside realm
  let {
    module: realmModule,
    bannedConstructors,
    iteratedMethods,
    RegExp
  } = realm.evaluate(prelude)

  let computeUsage = 0

  let abortState = {
    aborting: false,
    message: null
  }

  let burnHandler = (value) => {
    // throw if a previous burn handler already errored
    // TODO: find better way to abort?
    if (abortState.aborting) {
      throw Error(`Execution failed: ${abortState.message}`)
    }

    try {
      // ban use of function constructors and typed arrays.
      // (with function constructors, an attacker could execute
      // uninstrumented code)
      // also prevents shadowing the burn handler identifier, which would
      // allow instrumented code to not actually call the burn handler.
      // XXX: this prevents using the constructor's static methods
      // TODO: allow, but wrap to instrument code when called
      // with typed arrays, the attacker could exhaust our memory by creating
      // a very long instance.
      // TODO: allow typed arrays, but measure the memory cost before creating the instance
      if (bannedConstructors.has(value)) {
        throw Error(`${value.name} is not allowed`)
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

      computeUsage += 1
      if (computeUsage > opts.computeLimit) {
        throw Error('Exceeded compute limit')
      }

      let memoryUsage = memoryMeter.count(value)
      if (memoryUsage > opts.memoryLimit) {
        throw Error('Exceeded memory limit')
      }

      return value
    } catch (err) {
      abortState.aborting = true
      if (!abortState.message) {
        abortState.message = err.message
      }

      throw Error(`Execution failed: ${abortState.message}`)
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
    module: realmModule,

    // blacklisted globals
    JSON: undefined,
    RegExp: undefined,
    SES: undefined
  })

  // TODO: wrap to inherit rather than assigning?
  if (opts.module) {
    // assign to module from `opts.module`
    let exports = realmModule.exports
    Object.assign(
      realmModule,
      protect.internalWritable(opts.module)
    )
    // copy exported functions to the new exports object
    for (let [ key, value ] of Object.entries(exports)) {
      if (typeof value !== 'function') continue
      realmModule.exports[key] = value
    }
  }

  return protect.external(realmModule.exports, abortState)
}

function getBurnIdentifier (code) {
  return `burn_${sha256(code)}`
}

function sha256 (data) {
  return createHash('sha256').update(data).digest('hex')
}

module.exports = createModule
