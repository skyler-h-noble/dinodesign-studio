import { Button, H3 } from '@dynodesign/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';

interface TopBarProps {
  designSystemName: string;
  onBack: () => void;
  themed?: boolean;
}

export function CreationTopBar({ designSystemName, onBack, themed }: TopBarProps) {
  const handleCancel = () => {
    const ok = window.confirm('Cancel and leave this design? Unsaved changes will be lost.');
    if (ok) window.location.href = '/';
  };
  return (
    <div
      data-theme={themed ? 'Brand-App-Bar' : 'App-Bar'}
      data-surface="Surface"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'var(--Background, #fff)',
        borderBottom: '1px solid var(--Border, #e0e0e0)',
        minHeight: 48,
      }}
    >
      <Button
        variant="ghost"
        size="small"
        onClick={onBack}
        startIcon={<ArrowBackIcon style={{ fontSize: 16 }} />}
        sx={{ color: 'var(--Text)', textDecoration: 'none' }}
      >
        Back
      </Button>
      <H3 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{designSystemName}</H3>
      <Button
        variant="ghost"
        size="small"
        onClick={handleCancel}
        startIcon={<CloseIcon style={{ fontSize: 18 }} />}
        sx={{ color: 'var(--Text)', textDecoration: 'none' }}
      >
        Cancel
      </Button>
    </div>
  );
}

interface BottomBarProps {
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  themed?: boolean;
}

export function CreationBottomBar({ onNext, nextLabel = 'Continue', disabled, themed }: BottomBarProps) {
  return (
    <div
      data-theme={themed ? 'Brand-Nav-Bar' : 'Nav-Bar'}
      data-surface="Surface"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '12px 24px',
        background: 'var(--Background, #fff)',
        borderTop: '1px solid var(--Border, #e0e0e0)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Button
        variant="primary"
        size="medium"
        onClick={onNext}
        disabled={disabled}
        style={{ minWidth: 200, padding: '12px 32px', fontWeight: 700 }}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
