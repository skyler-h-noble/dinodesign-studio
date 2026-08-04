import { useState } from 'react';
import {
  Card, VStack, HStack, Body, BodySmall, Button, TextField, Alert,
} from '@dynodesign/components';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { firebaseApp } from '../utils/firebase/client';

/**
 * Pairing card shown on the account page.
 *
 * The user opens the Figma plugin, copies the 6-character code it
 * displays, pastes it here, and clicks Pair. We call the
 * `claimPluginPairingCode` callable function — the cloud side ties the
 * code to this user's uid, then the plugin's poll loop picks up a custom
 * token and signs in. See functions/pluginPairing.js for the full flow.
 */
export default function PluginPairing() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePair = async () => {
    const trimmed = code.toUpperCase().replace(/\s+/g, '').trim();
    if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
      setError('Enter the 6-character code shown in the Figma plugin.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const fn = httpsCallable<{ code: string }, { ok: boolean }>(
        getFunctions(firebaseApp),
        'claimPluginPairingCode',
      );
      await fn({ code: trimmed });
      setSuccess(true);
      setCode('');
    } catch (err: any) {
      const msg = err?.message || 'Could not pair the plugin. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="medium">
      <VStack spacing={2} alignItems="flex-start">
        <BodySmall style={{
          fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)',
        }}>
          Figma plugin
        </BodySmall>
        <Body>Pair the OmniDesign plugin so it can sign in as you.</Body>
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          Open the plugin in Figma, click <strong>Connect to my account</strong>,
          and enter the 6-character code it shows below.
        </BodySmall>

        <HStack spacing={2} style={{ width: '100%', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="Pairing code"
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setCode(e.target.value.toUpperCase())}
              size="small"
              disabled={loading}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') handlePair();
              }}
              placeholder="e.g. AB12CD"
            />
          </div>
          <Button
            variant="default"
            size="small"
            onClick={handlePair}
            disabled={loading || code.length === 0}
          >
            {loading ? 'Pairing…' : 'Pair'}
          </Button>
        </HStack>

        {success && (
          <Alert variant="light" color="success" size="small">
            Plugin paired. Return to Figma — it should sign in within a few seconds.
          </Alert>
        )}
        {error && (
          <Alert variant="light" color="error" size="small">
            {error}
          </Alert>
        )}
      </VStack>
    </Card>
  );
}
