import { AppBar, ThemedZone } from '@dynodesign/components';

interface TopNavProps {
  designSystemName?: string;
}

export default function TopNav({ designSystemName }: TopNavProps) {
  return (
    <ThemedZone theme="App-Bar" surface="Surface-Bright" as="header">
      <AppBar
        mode="desktop"
        barColor="default"
        companyName={designSystemName || 'DinoDesign'}
      />
    </ThemedZone>
  );
}
