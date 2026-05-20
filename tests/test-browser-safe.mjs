import {test} from 'tape-six';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Node built-in module names (per `node --print "require('module').builtinModules"`).
// Any bare specifier matching one of these is a Node-runtime dependency and forbidden
// in the browser-safe subtrees (/core, /web).
const NODE_BUILTINS = new Set([
  'assert', 'assert/strict', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns',
  'dns/promises', 'domain', 'events', 'fs', 'fs/promises', 'http', 'http2',
  'https', 'inspector', 'inspector/promises', 'module', 'net', 'os', 'path',
  'path/posix', 'path/win32', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'readline/promises', 'repl', 'stream', 'stream/consumers',
  'stream/promises', 'stream/web', 'string_decoder', 'sys', 'timers',
  'timers/promises', 'tls', 'trace_events', 'tty', 'url', 'util', 'util/types',
  'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

const importRegex =
  /(?:^|\s)(?:import|export)\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const walkImports = (entryPath, visited = new Set(), violations = []) => {
  const abs = resolve(entryPath);
  if (visited.has(abs)) return violations;
  visited.add(abs);
  let source;
  try {
    source = stripComments(readFileSync(abs, 'utf-8'));
  } catch (e) {
    violations.push({file: abs, error: `cannot read: ${e.message}`});
    return violations;
  }
  importRegex.lastIndex = 0;
  let match;
  while ((match = importRegex.exec(source))) {
    const spec = match[1];
    if (spec.startsWith('node:')) {
      violations.push({file: abs, forbidden: spec});
    } else if (NODE_BUILTINS.has(spec)) {
      violations.push({file: abs, forbidden: spec});
    } else if (spec.startsWith('.')) {
      walkImports(resolve(dirname(abs), spec), visited, violations);
    }
    // third-party bare specifiers are out of scope here
  }
  return violations;
};

test('browser-safety: /core has no node:* or Node-builtin imports in its transitive graph', (t) => {
  const violations = walkImports(resolve(__dirname, '../src/core/index.js'));
  if (violations.length) console.error('Violations:', JSON.stringify(violations, null, 2));
  t.equal(violations.length, 0, 'no node:* or Node-builtin imports reachable from /core');
});

test('browser-safety: /web has no node:* or Node-builtin imports in its transitive graph', (t) => {
  const violations = walkImports(resolve(__dirname, '../src/web/index.js'));
  if (violations.length) console.error('Violations:', JSON.stringify(violations, null, 2));
  t.equal(violations.length, 0, 'no node:* or Node-builtin imports reachable from /web');
});
