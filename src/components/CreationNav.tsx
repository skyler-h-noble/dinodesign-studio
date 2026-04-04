import { Button, H5 } from '@dynodesign/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TopBarProps {
  designSystemName: string;
  onBack: () => void;
  themed?: boolean;
}

export function CreationTopBar({ designSystemName, onBack, themed }: TopBarProps) {
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
      >
        Back
      </Button>
      <H5 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{designSystemName}</H5>
      <div style={{ width: 70 }} />
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
        variant="default"
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
