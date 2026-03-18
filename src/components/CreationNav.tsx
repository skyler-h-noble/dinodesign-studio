import { Button, BodySmall, Body } from '@dynodesign/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TopBarProps {
  designSystemName: string;
  onBack: () => void;
}

export function CreationTopBar({ designSystemName, onBack }: TopBarProps) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      background: 'var(--Surface, #fff)',
      borderBottom: '1px solid var(--Border, #e0e0e0)',
    }}>
      <Button
        variant="outline"
        color="default"
        size="small"
        onClick={onBack}
        style={{ minWidth: 'auto', padding: '6px 8px' }}
      >
        <ArrowBackIcon style={{ fontSize: 18 }} />
      </Button>
      <Body style={{ fontWeight: 600, fontSize: '0.95rem' }}>{designSystemName}</Body>
    </div>
  );
}

interface BottomBarProps {
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
}

export function CreationBottomBar({ onNext, nextLabel = 'Continue', disabled }: BottomBarProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: '12px 24px',
      background: 'var(--Surface, #fff)',
      borderTop: '1px solid var(--Border, #e0e0e0)',
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <Button
        variant="solid"
        color="default"
        onClick={onNext}
        disabled={disabled}
        style={{ minWidth: 160, padding: '12px 32px', fontWeight: 700 }}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
