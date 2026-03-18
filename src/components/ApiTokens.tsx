import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { SUPABASE_STORAGE_BASE } from '../utils/generateDesignSystem';

/**
 * Route: /api/tokens/:uuid
 * Returns tokens.json content
 */
export function ApiTokensJson() {
  const { uuid } = useParams<{ uuid: string }>();
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) { setError('No UUID provided'); return; }

    fetch(`${SUPABASE_STORAGE_BASE}/${uuid}/tokens.json`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(setContent)
      .catch(() => setError('404 — Design system not found'));
  }, [uuid]);

  if (error) return <pre style={{ padding: 20, fontFamily: 'monospace' }}>{error}</pre>;
  return <pre style={{ padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{content}</pre>;
}

/**
 * Route: /api/tokens/:uuid/md
 * Returns DINO-TOKENS.md content as plain text
 */
export function ApiTokensMd() {
  const { uuid } = useParams<{ uuid: string }>();
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) { setError('No UUID provided'); return; }

    fetch(`${SUPABASE_STORAGE_BASE}/${uuid}/DINO-TOKENS.md`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(setContent)
      .catch(() => setError('404 — Design system not found'));
  }, [uuid]);

  if (error) return <pre style={{ padding: 20, fontFamily: 'monospace' }}>{error}</pre>;
  return <pre style={{ padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{content}</pre>;
}
