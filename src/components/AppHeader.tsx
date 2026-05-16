import { useEffect, useState } from 'react';
import { AppBar, Button, HStack } from '@dynodesign/components';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { useAuth } from '../contexts/AuthContext';
import AvatarDropdown from './AvatarDropdown';
import CartIcon from './CartIcon';

/**
 * Signed-in app shell header.
 *
 *   [Brand]                                  [New Design] [Bell] [Avatar▾]
 *
 * AppBar provides the shell (theming, sticky positioning, slot layout).
 * The avatar dropdown and the bell are both inlined here because the lib
 * doesn't ship working primitives for them (see MISSING-LIB-COMPONENT tags).
 */
export default function AppHeader() {
  const { user, signOut } = useAuth();
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    if (!user) { setPendingChanges(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'designSystems'),
          where('userId', '==', user.uid),
        ));
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
    <AppBar
      brand="DinoDesign"
      onBrandClick={() => { window.location.href = '/'; }}
      endSlot={
        <HStack spacing={1} style={{ alignItems: 'center', gap: 8 }}>
          <Button
            variant="default"
            size="small"
            onClick={() => { window.location.href = '/create'; }}
          >
            New Design
          </Button>

          {user && <NotificationBell count={pendingChanges} />}
          {user && <CartIcon />}

          {user ? (
            <AvatarDropdown
              user={user}
              onSignOut={async () => { await signOut(); window.location.href = '/'; }}
            />
          ) : (
            <Button variant="outline" color="default" size="small" onClick={() => { window.location.href = '/?login=true'; }}>
              Login
            </Button>
          )}
        </HStack>
      }
    />
  );
}

function NotificationBell({ count }: { count: number }) {
  return (
    <Button
      iconOnly
      variant="ghost"
      size="small"
      badge={count > 0}
      badgeContent={count}
      aria-label={count > 0 ? `${count} pending changes` : 'Notifications'}
      onClick={() => { window.location.href = '/my-designs'; }}
    >
      <NotificationsNoneIcon style={{ fontSize: 22 }} />
    </Button>
  );
}
