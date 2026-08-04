// Transform a generated component file into a form react-live can render
// in `noInline` mode. The generated JSX from convertFigmaToCode is a full
// file with imports and `export default function ...`, but react-live's
// noInline expects the code to define components inline and end with
// `render(<MyComponent />)` since imports/exports are not supported in
// the in-browser eval context.
//
// We do four things:
//   1. Strip all import statements (scope provides them via LiveProvider).
//   2. Strip `export default` (react-live doesn't understand it).
//   3. Find the default-exported component's name.
//   4. Append `render(<ComponentName />)` so react-live mounts it.
//
// Also handles `// MISSING-LIB-COMPONENT: Foo` placeholders gracefully by
// providing a transparent fallback component for any missing identifier
// the live render encounters at runtime — this is wired in scope-side.

export function prepareLiveCode(jsx: string): { code: string; error?: string } {
  if (!jsx.trim()) return { code: '', error: 'No code yet.' };

  let work = jsx;

  // ── 1. Strip imports ─────────────────────────────────────────────
  work = work.replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, '');
  work = work.replace(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm, '');

  // ── 2. Capture the default-exported component name BEFORE rewriting.
  //    We check several patterns and take the first that matches. ───
  let componentName: string | null = null;

  // Pattern A: export default function Name(...)
  let m = work.match(/\bexport\s+default\s+function\s+(\w+)/);
  if (m) componentName = m[1];

  // Pattern B: export default Name; (bare identifier, must be PascalCase)
  if (!componentName) {
    m = work.match(/\bexport\s+default\s+([A-Z]\w*)\b/);
    if (m) componentName = m[1];
  }

  // Pattern C: export default <anything> — anonymous fn or arrow.
  //    Generate a synthetic name and wrap.
  let anonymousExport = false;
  if (!componentName) {
    if (/\bexport\s+default\b/.test(work)) {
      componentName = '__LiveDefault';
      anonymousExport = true;
    }
  }

  // ── 3. Strip ALL `export default` and named `export` keywords. The
  //    most common cause of leftover `default` tokens is a pattern our
  //    targeted regex missed; broad strips guarantee we never feed a
  //    `default` keyword to the parser. ───────────────────────────
  if (anonymousExport) {
    // export default function(...) → function __LiveDefault(...)
    work = work.replace(/\bexport\s+default\s+function\s*\(/, 'function __LiveDefault(');
    // export default (...) => ...  OR  export default x => ...
    work = work.replace(/\bexport\s+default\s+(?=(\(|[A-Za-z_$]))/, 'const __LiveDefault = ');
    // Anything else still labelled `export default` → const wrap
    work = work.replace(/\bexport\s+default\s+/, 'const __LiveDefault = ');
  } else {
    // For named-default cases: rewrite `export default function Name` →
    // `function Name`, and `export default Name;` → `` (the declaration
    // already exists earlier in the file).
    work = work.replace(/\bexport\s+default\s+function\s+/, 'function ');
    work = work.replace(/\bexport\s+default\s+[A-Z]\w*\s*;?\s*/, '');
  }

  // Strip named `export` keyword from any remaining declarations.
  work = work.replace(/^\s*export\s+(const|let|var|function|class|interface|type|enum)\s+/gm, '$1 ');
  // Strip stray re-export forms: export { A, B } from "x"; or export {};
  work = work.replace(/^\s*export\s+\{[^}]*\}(\s+from\s+['"][^'"]+['"])?\s*;?\s*$/gm, '');
  // Last-resort: any `export ` token that survived → remove the keyword only.
  work = work.replace(/\bexport\s+/g, '');

  if (!componentName) {
    return {
      code: '',
      error: 'Could not find a default-exported component to render.',
    };
  }

  const final = `${work.trim()}\n\nrender(<${componentName} />);`;

  // Debug helper — drop the transformed code into window for inspection.
  // Open DevTools console and type `__liveCode` to see what react-live
  // is parsing. Stripped before publish if this ever becomes customer-
  // facing.
  if (typeof window !== 'undefined') {
    (window as unknown as { __liveCode: string }).__liveCode = final;
  }

  return { code: final };
}
