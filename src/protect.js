'use strict'

const { IGNORE } = require('./memory-meter.js')

// TODO: WeakMap reference->proxy mapping so we can preserve
//       identities

// prevent all modifications
const readOnlyTraps = {
  set: throwReadOnlyError,
  setPrototypeOf: throwReadOnlyError,
  preventExtensions: throwReadOnlyError,
  defineProperty: throwReadOnlyError,
  deleteProperty: throwReadOnlyError
}

// allow setting with no protection, but prevent setting prototype, or freezing
const writableTraps = {
  // TODO: prevent apply/construct?
  getPrototypeOf (target) {
    // prototypes are read-only
    let prototype = Reflect.getPrototypeOf(target)
    return internal(prototype)
  },
  setPrototypeOf: throwReadOnlyError,
  preventExtensions: throwReadOnlyError // XXX: do we need this?
}

function throwReadOnlyError () {
  throw Error('Protected object is read-only')
}

function protect (value, applyTrap, readOnly = true, unprotectedParent) {
  function protectedTrap (method) {
    return (...args) => {
      let returnValue = method(...args)
      return protect(returnValue, applyTrap, readOnly, value)
    }
  }

  // primitives get passed through
  if (Object(value) !== value) {
    return value
  }

  // wrap with in-Realm Proxy,
  // which protects values returned by accesses,
  // and errors when trying to modify
  let proxy = new Proxy(value, {
    // accesses
    get: protectedTrap(Reflect.get),
    getPrototypeOf: protectedTrap(Reflect.getPrototypeOf),
    isExtensible: protectedTrap(Reflect.isExtensible),
    getOwnPropertyDescriptor: protectedTrap(Reflect.getOwnPropertyDescriptor),
    ownKeys: protectedTrap(Reflect.ownKeys),
    construct: protectedTrap(Reflect.construct),
    has (target, key) {
      // signal to MemoryMeter that protected values should not be counted
      if (key === IGNORE) return true
      return Reflect.has(target, key)
    },
    apply (target, thisArg, args) {
      // this trap is specified via `applyTrap` since it works differently
      // for interval vs external.
      // we use the unprotected parent as the `thisArg`
      return applyTrap(target, unprotectedParent, args)
    },

    ...(readOnly ? readOnlyTraps : writableTraps)
  })

  return proxy
}

function internal (value) {
  return protect(value, (target, thisArg, args) => {
    // protect return value to prevent escape
    let returnValue = Reflect.apply(target, thisArg, args)
    return internal(returnValue)
  })
}

function external (value, abortState) {
  return protect(value, (target, thisArg, args) => {
    // calls should fail if we aborted
    if (abortState.aborting) {
      throw Error('Box was aborted')
    }

    // protect arguments and `this` to prevent escape
    args = external(args)
    try {
      return Reflect.apply(target, thisArg, args)
    } catch (err) {
      if (abortState.aborting) {
        throw Error(`Execution failed: ${abortState.message}`)
      }
      throw err
    }
  })
}

function internalWritable (value) {
  return protect(value, (target, thisArg, args) => {
    // protect return value to prevent escape
    let returnValue = Reflect.apply(target, thisArg, args)
    return internalWritable(returnValue)
  }, false)
}

module.exports = {
  internal,
  external,
  internalWritable
}
