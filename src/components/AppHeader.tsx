import { useEffect, useState } from 'react';
import { Button, H3, HStack } from '@dynodesign/components';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { useAuth } from '../contexts/AuthContext';

/**
 * Shared signed-in app bar. Same shape as LandingPage's top nav (brand left,
 * right-side buttons), with a notification bell that surfaces the count of
 * design systems the user has unpushed changes on (version > lastPushedVersion).
 */
export default function AppHeader() {
  const { user, signOut } = useAuth();
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    if (!user) { setPendingChanges(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'designSystems'), where('userId', '==', user.uid)));
        let count = 0;
        snap.forEach(d => {
          const data = d.data() as any;
          const v = Number(data.version || 0);
          const lastPushed = Number(data.lastPushedVersion || 0);
          if (v > lastPushed) count++;
        });
        if (!cancelled) setPendingChanges(count);
      } catch (err) {
        console.error('AppHeader: failed to count pending changes', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <nav
      data-theme="App-Bar"
      data-surface="Surface-Bright"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        height: 64,
        padding: '0 24px',
        background: 'var(--Background)',
        borderBottom: '1px solid var(--Border)',
      }}
    >
      <H3
        style={{ margin: 0, flexShrink: 0, cursor: 'pointer' }}
        onClick={() => window.location.href = '/'}
      >
        DinoDesign
      </H3>

      <div style={{ flex: 1 }} />

      <HStack spacing={1} style={{ flexShrink: 0, alignItems: 'center' }}>
        {user && (
          <button
            type="button"
            aria-label={pendingChanges > 0 ? `${pendingChanges} pending changes` : 'Notifications'}
            onClick={() => window.location.href = '/account#my-designs'}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--Text)',
            }}
          >
            <NotificationsNoneIcon style={{ fontSize: 22 }} />
            {pendingChanges > 0 && (
              <span style={{
                position: 'absolute',
                top: 4, right: 4,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 8,
                background: 'var(--Buttons-Error-Button, #c0392b)',
                color: 'var(--Buttons-Error-Text, #fff)',
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}>
                {pendingChanges}
              </span>
            )}
          </button>
        )}
        {user ? (
          <>
            <Button variant="ghost" size="small" onClick={() => window.location.href = '/account'}>
              Account
            </Button>
            <Button variant="ghost" size="small" onClick={() => signOut()}>
              Sign Out
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="small" onClick={() => window.location.href = '/?login=true'}>
            Login
          </Button>
        )}
        <Button
          variant="default"
          size="small"
          onClick={() => window.location.href = '/create'}
        >
          New Design
        </Button>
      </HStack>
    </nav>
  );
}
