'use strict'

const IGNORE = Symbol('MemoryMeter ignore')

// TODO: count variables (in instrumentation step), since we
//       can't differentiate between overwriting primitves
//       and allocating new ones

class MemoryMeter {
  constructor () {
    this.existingCosts = new WeakMap()
    this.sum = 0
  }

  count (value) {
    let cost = getCost(value)

    let existingCost = 0
    if (!isPrimitive(value)) {
      existingCost = this.existingCosts.get(value) || 0
      this.existingCosts.set(value, cost)
    }

    // XXX: increase monotonically, even if we delete a bunch of keys
    //      since we are targeting use cases which run too fast for
    //      GC to kick in
    this.sum += Math.max(cost - existingCost, 0)

    return this.sum
  }
}

function isPrimitive (value) {
  return Object(value) !== value
}

function getCost (value) {
  // primitives
  // XXX: this method of counting results in a much
  //      higher cost than it needs, for example
  //      one variable iterating through many numbers
  //      incurs the cost N times

  if (typeof value === 'string') {
    return value.length
  }

  if (isPrimitive(value)) {
    return 1
  }

  // non-primitives

  // ignore exempted values
  if (IGNORE in value) {
    return 0
  }

  // TODO: handle typed arrays

  // TODO: ensure this isn't easily spoofable
  if (Array.isArray(value)) {
    return value.length * 4
  }

  // count keys in objects
  // TODO: is there a faster way? not sure how JS
  //       engines get these lists
  let keys = [].concat(
    Object.getOwnPropertyNames(value),
    Object.getOwnPropertySymbols(value)
  )
  return keys.length * 4
}

module.exports = MemoryMeter
Object.assign(MemoryMeter, {
  IGNORE,
  isPrimitive,
  getCost
})
