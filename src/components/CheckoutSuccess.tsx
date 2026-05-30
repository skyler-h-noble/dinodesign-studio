import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { H2, Body, BodySmall, VStack, Link } from '@dynodesign/components';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/client';

/**
 * Stripe redirects here after successful checkout.
 * Polls Firestore for credit update (set by webhook), then redirects to the studio.
 */
export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'checking' | 'ready' | 'timeout'>('checking');
  const sessionId = searchParams.get('session_id');
  // dsId is the draft design system written to Firestore right before the
  // Stripe redirect. Carrying it back in the URL lets us rehydrate the user's
  // in-progress build and drop them into the Export stage to finish.
  const dsId = searchParams.get('dsId');

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
          // Resume where the user left off: if we have a dsId from the
          // pre-checkout draft, hydrate from it and land on Export. Without
          // a dsId we fall back to the start of /create.
          //
          // IMPORTANT: use window.location.href (full page load) instead of
          // react-router navigate(). App.tsx's rehydration effect runs on
          // mount with `[]` deps reading window.location.search directly —
          // a SPA navigation wouldn't re-trigger it, so the user would land
          // on /create with stage stuck at the default 'name'.
          const dest = dsId
            ? `/create?id=${dsId}&stage=export`
            : '/create';
          // Brief enough to feel intentional; short enough to not be a wait.
          // The /create page has its own loading splash while it rehydrates.
          setTimeout(() => { window.location.href = dest; }, 600);
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
  }, [user, dsId]);

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
            <Link
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                const dest = dsId
                  ? `/create?id=${dsId}&stage=export`
                  : '/create';
                // Full page load (see note in the ready-state redirect above).
                window.location.href = dest;
              }}
            >
              Go to studio anyway →
            </Link>
          </Body>
        </>
      )}
    </VStack>
  );
}
