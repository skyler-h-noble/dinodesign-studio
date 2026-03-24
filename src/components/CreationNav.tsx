import { Button, BodySmall, Body } from '@dynodesign/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface TopBarProps {
  designSystemName: string;
  onBack: () => void;
  themed?: boolean;
}

export function CreationTopBar({ designSystemName, onBack, themed }: TopBarProps) {
  return (
    <div
      data-theme={themed ? 'Brand-App-Bar' : undefined}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--Background, var(--Surface, #fff))',
        borderBottom: '1px solid var(--Border, #e0e0e0)',
      }}
    >
      <Button
        variant="outline"
        color="default"
        size="small"
        onClick={onBack}
        style={{ minWidth: 'auto', padding: '6px 12px', gap: 4 }}
      >
        <ArrowBackIcon style={{ fontSize: 16 }} />
        Back
      </Button>
      <h3 style={{ fontWeight: 700, fontSize: '1.4rem', textAlign: 'center', margin: 0, color: 'var(--Header)' }}>{designSystemName}</h3>
      <div />
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
      data-theme={themed ? 'Brand-Nav-Bar' : undefined}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '12px 24px',
        background: 'var(--Background, var(--Surface, #fff))',
        borderTop: '1px solid var(--Border, #e0e0e0)',
      display: 'flex',
      justifyContent: 'center',
    }}>
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
