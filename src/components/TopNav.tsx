import { AppBar, ThemedZone } from '@omni-design/components';

interface TopNavProps {
  designSystemName?: string;
}

export default function TopNav({ designSystemName }: TopNavProps) {
  return (
    <ThemedZone theme="Brand-App-Bar" surface="Surface" as="header">
      <AppBar
        mode="desktop"
        barColor="default"
        companyName={designSystemName || 'OmniDesign'}
      />
    </ThemedZone>
  );
}
