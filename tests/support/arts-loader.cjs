const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// Render the real server components with explicit test-only service boundaries.
// No auth bypass or preview route is included in the application.
function createLoader(overrides = {}) {
  const cache = new Map();
  const mocks = {
    'server-only': {},
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    'next/navigation': {
      notFound() { throw new Error('NEXT_NOT_FOUND'); },
      redirect(url) { throw new Error(`NEXT_REDIRECT:${url}`); },
      usePathname: () => '/arts/overview',
      useSearchParams: () => new URLSearchParams(),
    },
    ...overrides,
  };
  function load(file) {
    const full = path.resolve(file);
    if (cache.has(full)) return cache.get(full).exports;
    const m = new Module(full, module);
    cache.set(full, m);
    m.filename = full;
    m.paths = Module._nodeModulePaths(path.dirname(full));
    const original = m.require.bind(m);
    m.require = name => {
      if (name in mocks) return mocks[name];
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(full), name);
        const target = ['.ts', '.tsx', ''].map(ext => base + ext).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (target) return load(target);
      }
      return original(name);
    };
    m._compile(ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, full);
    return m.exports;
  }
  return load;
}
module.exports = { createLoader };
