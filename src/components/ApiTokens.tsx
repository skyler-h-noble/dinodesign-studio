/*
 * The raw <pre> in this file is deliberate, and the one place in the studio
 * where a code panel should NOT be `CodeBlock`.
 *
 * These two routes are payload endpoints, not pages. The `/md` URL is handed to
 * the user to give to their own AI tool (see `claudeMdUrl` in
 * DesignSystemDetail) — what matters is that the body is the file and nothing
 * else. CodeBlock would wrap it in a themed dark panel with a header label and
 * a copy button, which is chrome around a response.
 *
 * So: no header, no copy button, no theming. `white-space: pre-wrap` and a
 * monospace stack, which is what a browser shows for `text/plain`.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getPublicFileUrl } from '../utils/firebase/storage';

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
    let mounted = true;

    fetch(getPublicFileUrl(uuid, 'tokens.json'))
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(text => { if (mounted) setContent(text); })
      .catch(() => { if (mounted) setError('404 — Design system not found'); });

    return () => { mounted = false; };
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
    let mounted = true;

    fetch(getPublicFileUrl(uuid, 'DINO-TOKENS.md'))
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.text();
      })
      .then(text => { if (mounted) setContent(text); })
      .catch(() => { if (mounted) setError('404 — Design system not found'); });

    return () => { mounted = false; };
  }, [uuid]);

  if (error) return <pre style={{ padding: 20, fontFamily: 'monospace' }}>{error}</pre>;
  return <pre style={{ padding: 20, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{content}</pre>;
}
