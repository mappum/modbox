'use strict'

const { IGNORE } = require('./memory-meter.js')

function protect (value, applyTrap, unprotectedParent) {
  function protectedTrap (method) {
    return (...args) => {
      let returnValue = method(...args)
      return protect(returnValue, applyTrap, value)
    }
  }

  function throwReadOnlyError () {
    throw Error('Protected object is read-only')
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

    // modifications
    set: throwReadOnlyError,
    setPrototypeOf: throwReadOnlyError,
    preventExtensions: throwReadOnlyError,
    defineProperty: throwReadOnlyError,
    deleteProperty: throwReadOnlyError
  })

  return proxy
}

function internal (value) {
  return protect(value, (target, thisArg, args) => {
    // protect return value to prevent escape
    let returnValue = Reflect.apply(target, thisArg, args)
    return protect(returnValue)
  })
}

function external (value) {
  return protect(value, (target, thisArg, args) => {
    // protect arguments and `this` to prevent escape
    args = protect(args)
    return Reflect.apply(target, thisArg, args)
  })
}

module.exports = {
  internal,
  external
}
