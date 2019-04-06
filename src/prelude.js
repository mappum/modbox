'use strict'

function prelude (burnId) {
  // TODO: wrap all built-in functions to make a `burn` call
  //       so an attacker can't do:
  //         `bigArray.forEach(someBuiltInFunction)`

  let module = { exports: {} }

  // get the function constructors so we can ban their usage in
  // the burn handler
  let functionConstructors = new Set([
    Function,
    Object.getPrototypeOf(async function () {}).constructor,
    Object.getPrototypeOf(function * () {}).constructor,
    Object.getPrototypeOf(async function * () {}).constructor
  ])

  return {
    module,
    RegExp,
    functionConstructors
  }
}

module.exports = `"use strict"; (${prelude}());`
