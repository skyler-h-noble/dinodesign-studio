// Minimal custom live preview. Replaces react-live which kept injecting
// CommonJS boilerplate that produced misleading "Unexpected token 'default'"
// errors on otherwise-clean output. Direct sucrase JSX transform + new
// Function eval with the provided scope.

import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { transform as sucraseTransform } from 'sucrase';

interface LivePreviewProps {
  /** Code string ending in `render(<ComponentName />);` (noInline-style). */
  code: string;
  /** Identifier map provided to the eval — lib components, React, hooks. */
  scope: Record<string, unknown>;
  /** Optional className on the host div. */
  className?: string;
  /** Optional inline style on the host div. */
  style?: React.CSSProperties;
}

export function CustomLivePreview({ code, scope, className, style }: LivePreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    setError(null);

    try {
      // Extract the trailing `render(<Foo ... />)` call. The rest of the
      // code defines the component(s). We compile the rest with sucrase,
      // wrap in a Function that exposes scope identifiers as parameters,
      // and `return` the rendered React element to mount manually.
      const renderMatch = code.match(/render\(\s*(<[\s\S]+?\/?>)\s*\)\s*;?\s*$/);
      if (!renderMatch) {
        throw new Error('No render(<Component />) call found in code.');
      }
      const renderExpr = renderMatch[1];
      const componentSource = code.slice(0, renderMatch.index).trim();

      // Build a single function body: declarations + return.
      // Sucrase transforms JSX + TypeScript in one pass. The 'imports'
      // transform is omitted — it was the source of the spurious 'default'
      // tokens — because the code has no imports left to convert by the
      // time it reaches us (prepareLiveCode strips them).
      const wrappedSource = `${componentSource}\nreturn (${renderExpr});`;

      const transformed = sucraseTransform(wrappedSource, {
        transforms: ['typescript', 'jsx'],
        production: true,
      }).code;

      // Materialize the eval function with scope identifiers as args.
      // JS RESERVED WORDS cannot be parameter names — most commonly the
      // 'default' property that ES-module namespace objects expose (Vite
      // synthesizes it for CJS interop, so `...DynoComponents` includes
      // a `default` key even when there's no explicit default export).
      // Filter those out; the code never references them anyway.
      const RESERVED = new Set([
        'default', 'void', 'delete', 'if', 'else', 'for', 'while', 'do',
        'function', 'return', 'class', 'const', 'let', 'var', 'new',
        'this', 'super', 'switch', 'case', 'break', 'continue', 'throw',
        'try', 'catch', 'finally', 'in', 'of', 'instanceof', 'typeof',
        'with', 'yield', 'async', 'await', 'static', 'import', 'export',
        'true', 'false', 'null', 'undefined',
      ]);
      const scopeKeys = Object.keys(scope).filter(k =>
        !RESERVED.has(k) && /^[A-Za-z_$][\w$]*$/.test(k),
      );
      const scopeValues = scopeKeys.map(k => scope[k]);
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const evalFn = new Function(...scopeKeys, transformed);

      const element = evalFn(...scopeValues) as React.ReactElement;

      // Mount via React 18 createRoot. Reuse the root across renders so
      // we don't recreate the React tree per code edit.
      if (!rootRef.current) {
        rootRef.current = createRoot(hostRef.current);
      }
      rootRef.current.render(element);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (rootRef.current) {
        // Clear any previously-rendered tree so a stale render doesn't
        // sit beneath the error message.
        try { rootRef.current.render(<></>); } catch { /* noop */ }
      }
    }
  }, [code, scope]);

  // Unmount the root on full unmount to avoid leaking React trees.
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <div
        ref={hostRef}
        className={className}
        style={style}
      />
      {error && (
        <div
          style={{
            margin: '8px 0 0',
            padding: 12,
            borderRadius: 8,
            background: 'var(--Container)',
            color: 'var(--Error-Color-5)',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
