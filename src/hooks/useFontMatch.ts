// useFontMatch — run the local ranking against the sampled crop.
//
// Rasterising ~40 candidates takes a moment, so this reports a status the panel
// can show ("Measuring the suggestions against the crop…") rather than blocking
// or silently appearing later. Keyed on the crop + the pool, so it re-runs when
// the user picks a different region and not otherwise.

import { useEffect, useState } from 'react';
import { rankFamilies, type FontScore, type MatchInput } from '../utils/fontMatch';

export interface FontMatchState {
  status: 'idle' | 'working' | 'done';
  /** Best first. */
  ranked: FontScore[];
  /** family → score, for annotating chips in place. */
  scores: Record<string, FontScore>;
  /** Identity of the run that produced `ranked` — crop + pool. */
  key: string | null;
}

const EMPTY: FontMatchState = { status: 'idle', ranked: [], scores: {}, key: null };

export function useFontMatch(
  region: MatchInput | null,
  families: string[],
): FontMatchState {
  const [state, setState] = useState<FontMatchState>(EMPTY);
  const key = region ? `${region.dataUrl.slice(-64)}|${families.join(',')}` : null;

  useEffect(() => {
    if (!region || families.length === 0 || !key) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'working' }));

    rankFamilies(region, families)
      .then((ranked) => {
        if (cancelled) return;
        const scores: Record<string, FontScore> = {};
        for (const r of ranked) scores[r.family] = r;
        setState({ status: 'done', ranked, scores, key });
      })
      .catch(() => {
        if (!cancelled) setState({ ...EMPTY, status: 'done', key });
      });

    return () => { cancelled = true; };
    // `key` captures both inputs; re-running on the array identity alone would
    // loop forever, since the pool is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
