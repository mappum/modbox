'use strict'

function prelude (burnId) {
  // TODO: protect against Function/etc constructors
  //       so that an attacker can't run uninstrumented code

  // TODO: wrap all built-in functions to make a `burn` call
  //       so an attacker can't do:
  //         `bigArray.forEach(someBuiltInFunction)`

  let module = { exports: {} }

  return {
    module,
    RegExp
  }
}

module.exports = `(${prelude}());`
