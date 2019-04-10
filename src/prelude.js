'use strict'

function prelude () {
  // get banned constructors so we can ban their usage in
  // the burn handler
  let bannedConstructors = new Set([
    Function,
    Object.getPrototypeOf(async function () {}).constructor,
    Object.getPrototypeOf(function * () {}).constructor,
    Object.getPrototypeOf(async function * () {}).constructor,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array
  ])

  // get the collection prototypes' iterated methods (map, forEach, filter, etc.)
  // so we can make them consume gas for each iteration
  let collectionConstructors = [
    Array,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    Map,
    Set,
    WeakMap,
    WeakSet
  ]
  let iteratedMethods = new Set()
  for (let T of collectionConstructors) {
    let methods = [
      T.prototype.forEach,
      T.prototype.map,
      T.prototype.filter,
      T.prototype.reduce
    ]
    methods
      .filter((m) => !!m)
      .map((m) => iteratedMethods.add(m))
  }

  // build object for module to set its exports on
  let module = { exports: {} }

  return {
    module,
    bannedConstructors,
    iteratedMethods,
    RegExp,
    stringRepeat: String.prototype.repeat
  }
}

module.exports = `"use strict"; (${prelude})();`
