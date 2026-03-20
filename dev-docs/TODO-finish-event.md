# RESOLVED: `finish` event now works after `stop`

Replaced all `stream.destroy()` calls in `asStream.js` with a `stopped` flag. The flag causes subsequent `write()` calls to short-circuit with `callback(null)`, preventing `push()` after EOF. This lets `end` and `finish` events propagate normally to downstream pipes.

Also fixed a pre-existing bug: the `final()` asyncChain error handler was not catching `Stop` errors from async flush operations — they were passed through as real errors.

The `stop` test in `tests/test-asStream-fast.mjs` now verifies `finish` fires on a piped writable.
