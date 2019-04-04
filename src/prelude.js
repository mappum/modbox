'use strict'

function prelude () {
  // TODO: protect against Function/etc constructors
  //       so that an attacker can't run uninstrumented code

  let module = { exports: {} }

  return {
    module,
    RegExp
  }
}

module.exports = `(${prelude}());`
