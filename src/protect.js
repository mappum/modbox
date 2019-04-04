'use strict'

function protect (value) {
  function protectedTrap (method) {
    return (...args) => {
      let returnValue = method(...args)
      return protect(returnValue, proxy)
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
    has: protectedTrap(Reflect.has),
    ownKeys: protectedTrap(Reflect.ownKeys),
    construct: protectedTrap(Reflect.construct),
    apply (target, thisArg, args) {
      // call with protected 'this'
      thisArg = protect(thisArg)
      let returnValue = Reflect.apply(target, thisArg, args)
      return protect(returnValue)
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

module.exports = protect
