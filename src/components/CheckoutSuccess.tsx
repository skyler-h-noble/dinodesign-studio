import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { H2, Body, BodySmall, VStack } from '@dynodesign/components';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/client';

/**
 * Stripe redirects here after successful checkout.
 * Polls Firestore for credit update (set by webhook), then redirects to the studio.
 */
export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ready' | 'timeout'>('checking');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!user) return;

    let attempts = 0;
    const maxAttempts = 20; // 20 × 2s = 40 seconds max wait

    const checkCredits = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const credits = userDoc.exists() ? (userDoc.data().credits || 0) : 0;

        if (credits > 0) {
          setStatus('ready');
          // Redirect back to the studio after a brief confirmation
          setTimeout(() => navigate('/create', { replace: true }), 2000);
          return;
        }
      } catch {
        // Continue polling
      }

      attempts++;
      if (attempts >= maxAttempts) {
        setStatus('timeout');
      } else {
        setTimeout(checkCredits, 2000);
      }
    };

    checkCredits();
  }, [user, navigate]);

  return (
    <VStack spacing={4} style={{ padding: '80px 24px', alignItems: 'center', maxWidth: 500, margin: '0 auto' }}>
      {status === 'checking' && (
        <>
          <H2 style={{ textAlign: 'center' }}>Payment received!</H2>
          <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            Setting up your account... This may take a moment.
          </Body>
          <div className="typo-spinner" />
        </>
      )}

      {status === 'ready' && (
        <>
          <H2 style={{ textAlign: 'center' }}>You're all set!</H2>
          <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            Your credits have been added. Redirecting you back...
          </Body>
        </>
      )}

      {status === 'timeout' && (
        <>
          <H2 style={{ textAlign: 'center' }}>Almost there</H2>
          <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            Your payment was received but credits are still being processed.
            This can take up to a minute.
          </Body>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Session: {sessionId}
          </BodySmall>
          <Body>
            <span style={{ color: 'var(--Hotlink)', cursor: 'pointer' }} onClick={() => navigate('/create', { replace: true })}>
              Go to studio anyway →
            </span>
          </Body>
        </>
      )}
    </VStack>
  );
}
