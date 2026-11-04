// compile.ts — the deterministic Figma → code compiler's front door.
//
//   compileFigmaFrame(frameJson) → { code, report, ir }
//
// Zero model tokens for everything the tables can map. Whatever they cannot is
// a FALLBACK marker in the code and an entry in report.fallbacks; figmaToCode's
// buildFallbackPrompt hands exactly those nodes to a model, and nothing else.
//
// Determinism: the same frame produces the same bytes. Nothing here reads a
// clock, a random source, the locale or an unordered collection, and the input
// is never mutated — report.sha256 is the one-string check of that.

import { buildIR, type IRDocument, type IROptions, type IRStats } from './ir';
import { compileTree, emitFile, type FallbackEntry, type NoteEntry } from './emitJsx';
import { sha256Hex } from './sha256';

export interface CompileReport {
  /** Visible nodes compiled / visible nodes in the frame. */
  coverage: { compiled: number; visible: number; ratio: number };
  /** Every node emitted as a FALLBACK marker, in compile order. */
  fallbacks: FallbackEntry[];
  /** Mapped, but something was lossy or left out on purpose. */
  notes: NoteEntry[];
  /** DERIVED-ARIA-LABEL lines (rule 0d) — guesses flagged for the designer. */
  derivedLabels: string[];
  /** Input facts: node count, plugin-note count, hidden nodes pruned. */
  stats: IRStats;
  /** SHA-256 of `code`. */
  sha256: string;
}

export interface CompileResult {
  code: string;
  report: CompileReport;
  ir: IRDocument;
}

export function compileFigmaFrame(frameJson: unknown, opts: IROptions = {}): CompileResult {
  const ir = buildIR(frameJson, opts);
  const tree = compileTree(ir);
  const code = emitFile(tree.root, {
    rootId: ir.root.id,
    rootName: ir.root.name,
    coverage: tree.coverage,
    fallbackCount: tree.fallbacks.length,
    derived: tree.derived,
  });
  return {
    code,
    ir,
    report: {
      coverage: tree.coverage,
      fallbacks: tree.fallbacks,
      notes: tree.notes,
      derivedLabels: tree.derived,
      stats: ir.stats,
      sha256: sha256Hex(code),
    },
  };
}

export type { IROptions } from './ir';
