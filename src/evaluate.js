'use strict'

const instrumentCode = require('./instrument.js')

function evaluateCode (code, burnHandler, nonce) {
  // TODO: ensure args are valid
  // TODO: figure out nonce
  let burnHandlerId = `burn${nonce}`
  let instrumented = instrumentCode(code)


}

module.exports = evaluateCode
