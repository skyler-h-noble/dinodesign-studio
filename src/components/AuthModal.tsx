import { useState } from 'react';
import {
  Modal, Button, H3, Body, BodySmall, VStack, HStack, TextField, Alert,
} from '@dynodesign/components';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ open, onClose, onSuccess }: Props) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists'
        : err.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters'
        : err.message || 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'signin' ? 'Sign In' : 'Create Account'}
    >
      <VStack spacing={3} style={{ minWidth: 340, maxWidth: 400 }}>
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          Sign in to generate and save your design system.
        </BodySmall>

        {/* Google sign-in */}
        <Button
          variant="outline"
          size="medium"
          onClick={handleGoogle}
          disabled={loading}
          startIcon={<GoogleIcon />}
          style={{ width: '100%' }}
        >
          Continue with Google
        </Button>

        {/* Divider */}
        <HStack spacing={2} style={{ alignItems: 'center', width: '100%' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--Border)' }} />
          <BodySmall style={{ color: 'var(--Quiet)', flexShrink: 0 }}>or</BodySmall>
          <div style={{ flex: 1, height: 1, background: 'var(--Border)' }} />
        </HStack>

        {/* Email/password */}
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          size="small"
          disabled={loading}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          size="small"
          disabled={loading}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleEmail(); }}
        />

        {error && (
          <Alert variant="light" color="error" size="small">
            {error}
          </Alert>
        )}

        <Button
          variant="default"
          size="medium"
          onClick={handleEmail}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </Button>

        <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          {mode === 'signin' ? (
            <>Don't have an account?{' '}
              <span
                style={{ color: 'var(--Hotlink)', cursor: 'pointer' }}
                onClick={() => { setMode('signup'); setError(null); }}
              >
                Sign up
              </span>
            </>
          ) : (
            <>Already have an account?{' '}
              <span
                style={{ color: 'var(--Hotlink)', cursor: 'pointer' }}
                onClick={() => { setMode('signin'); setError(null); }}
              >
                Sign in
              </span>
            </>
          )}
        </BodySmall>
      </VStack>
    </Modal>
  );
}
