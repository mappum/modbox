# modbox

*Securely box untrusted JS modules, with CPU and memory limiting*

----

modbox lets you run untrusted JavaScript by enclosing modules in a "box". It was made with JS smart contracts in mind, but can also be used anywhere you want to securely run someone else's code.

**WARNING:** This module is experimental and should not yet be used in production!

**Features:**
- CPU usage limiting ("gas metering" in Ethereum terminology)
- Memory limiting
- Modules are only allowed to access the data or APIs you explicitly give them
- Fully deterministic - code will always execute the same way no matter what
- Runs in-process - boxes are cheap to create
- Interact with boxed modules as you would any other module (e.g. call its exported functions)
- Powered by [@Agoric](https://github.com/agoric)'s [SES (Secure EcmaScript)](https://github.com/agoric/ses)

## Usage
`npm install modbox`

```js
let modbox = require('modbox')

let box = modbox(`
  module.exports = {
    n: 0,

    increment () {
      this.n += 1
    }
  }
`)

console.log(box.n) // 0
box.increment()
console.log(box.n) // 1
box.n++ // throws - box's state is read-only
```

### let box = modbox(code, [opts])

Creates a boxed module by evaluating the code string passed in as the `code` argument. The code should export a module by setting it as `module.exports`.

`opts` can be an options object containing:
- `allowConsole` *(default: false)* - Set to `true` to expose `console.log` inside the box.
- `globals` *(default: {})* - An object which contains global variables that will be accessible from inside the box.
- `computeLimit` *(default: 10,000,000)* - A number representing the amount of compute units to allow the boxed module to use. This is a rough unit, see the [CPU and Memory Limit Caveats](#cpu-and-memory-limit-caveats) section for more info.
- `memoryLimit` *(default: 10,000,000)* - A number representing the amount of memory units to allow the boxed module to use. This is a rough unit (it is NOT measured in bytes), see the [CPU and Memory Limit Caveats](#cpu-and-memory-limit-caveats) section for more info.
- `onBurn(value)` - A function which gets called continuously as the module executes code (both when initially created, and when its exported functions get called). `value` will be the result of each JS expression (e.g. for `5 + 5`, `onBurn` will be called 3 times - twice with `value = 5`, and once with `value = 10`). If this throws, the module will be terminated and further execution will be prevented.

## Execution Caveats

To prevent DoS attacks and non-determinism, this module is pretty conservative about what features are accessible from inside the box. The following are currently not allowed:

- `require` - instead, pass in other modules through the `globals` option
- `JSON` (e.g. `JSON.stringify(...)`)
- Regular expressions
- `Buffer`
- `Date.now()` (returns `NaN`)
- `new Date()` (returns `new Date(NaN)`, still works if you pass in a timestamp)
- `setTimeout()`/`setInterval()`/`setImmediate()`
- `Math.random()` (throws)
- `eval()` (not defined)
- The `Function` constructor
- Typed arrays (`Uint8Array`, etc.)

Some of these, e.g. `Buffer` and a limited form of `require` will likely be enabled in the future.

## CPU and Memory Limit Caveats

### CPU

CPU usage limiting works by counting up as the code executes (both in the initial eval that happens when the module is created, and when the module's functions get called from outside the box), then halting all execution once the limit is reached. This is the same as "gas" in the Ethereum world.

The metering is done by transpiling the module's source code to add calls to a "burn handler" function for every expression. The resulting code is functionally equivalent, but now calls out to this burn handler as it executes in order to measure CPU resource and memory usage.

Example:

**Original code:**
```js
module.exports = {
  n: 0,

  increment () {
    this.n += 1
  }
}
```

**Instrumented output:**
```js
burn(burn(module).exports = burn({
  n: burn(0),

  increment() {
    burn()

    burn(burn(this).n += burn(1));
  }
}));
```
In the resulting code, the initial module creation burns a small amount of gas, then each subsequent call to `increment()` burns some more.
(In the real code, the name of `burn` is actually a random string to prevent shadowing or name conflicts).

### Memory

Memory usage measurement is rough and errs on the side of counting too high in order to minimize memory exhaustion attacks. Also, it counts up monotonically so usage is counted even after it is freed by garbage collection (this is because the module is intended for use with smart contracts where the box is created, run, and thrown away too quickly for GC to kick in).

Since we don't know what optimizations the JS engine is doing, we simply count from a high-level, e.g. arrays and strings are counted based on their length, objects are counted based on the number of keys, etc.

This will likely improve over time, but our targeted smart-contract use case usually doesn't require a lot of memory and the goal is simply to prevent crashing the JS engine by exhausting its memory.
