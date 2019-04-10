'use strict'

const babel = require('babel-core')

const SKIP = Symbol('skip')

function instrumentCode (burnIdentifier, code) {
  let plugin = function ({ types: t }) {
    return {
      visitor: {
        Expression (path, state) {
          if (SKIP in path.node) {
            // is wrapper, skip
            return
          }
          if (path.type === 'MemberExpression') {
            // skip x.y expressions
            return
          }
          if (path.parentPath != null) {
            if (SKIP in path.parentPath.node) {
              // already wrapped, skip
              return
            }
            if (path.parentPath.type === 'UpdateExpression') {
              // skip for x++ and x--
              // (otherwise it would be `burn(x)++` which is invalid)
              return
            }
          }

          let call = t.callExpression(
            t.identifier(burnIdentifier),
            [ path.node ]
          )
          call[SKIP] = true

          path.replaceWith(call)
        },

        Function (path, state) {
          // add a call to `burn` in function bodies,
          // so an attacker can't do `bigArray.forEach(() => {})`
          // for free
          let call = t.callExpression(
            t.identifier(burnIdentifier),
            []
          )
          call[SKIP] = true

          if (path.node.body.type !== 'BlockStatement') {
            let returnValue = path.node.body
            path.node.body = t.blockStatement([
              t.returnStatement(returnValue)
            ])
            path.node.body[SKIP] = true
          }

          path.node.body.body.unshift(call)
        }
      }
    }
  }

  let transformed = babel.transform(code, {
    plugins: [ plugin ]
  })
  return transformed.code
}

module.exports = instrumentCode
