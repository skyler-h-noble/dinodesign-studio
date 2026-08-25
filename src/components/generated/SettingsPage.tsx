// #1 output — generated from a prompt using dinodesign-rules.md as the spec.
// "A settings page with Profile and Notifications tabs."
import { useState } from 'react';
import {
  Section,
  Container,
  VStack,
  HStack,
  Card,
  Divider,
  H2,
  Body,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  List,
  ListItem,
  SwitchInput,
  TextInput,
  Button,
  Avatar,
} from '@omni-design/components';

const NOTIFICATIONS = [
  { id: 'product',  title: 'Product updates',  desc: 'News about features and improvements.' },
  { id: 'security', title: 'Security alerts',   desc: 'Important notices about your account.' },
  { id: 'marketing', title: 'Marketing emails', desc: 'Tips, offers, and announcements.' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const [toggles, setToggles] = useState({ product: true, security: true, marketing: false });

  return (
    <Section surface="Surface" padding="48px 24px">
      <Container>
        <VStack gap="var(--Sizing-4)">
          <VStack gap="var(--Sizing-Half)">
            <H2>Settings</H2>
            <Body color="quiet">Manage your profile and notification preferences.</Body>
          </VStack>

          {/* Tabs: controlled (value/onChange pass the VALUE); Tab/TabPanel pair by value. */}
          <Tabs value={tab} onChange={setTab}>
            <TabList>
              <Tab value={0}>Profile</Tab>
              <Tab value={1}>Notifications</Tab>
            </TabList>

            <TabPanel value={0}>
              <Card padding="large">
                <VStack gap="var(--Sizing-2)">
                  <HStack gap="var(--Sizing-2)" alignItems="center">
                    <Avatar size="large" initials="LN" />
                    <Button variant="default-outline" size="small">Change photo</Button>
                  </HStack>
                  <TextInput label="Full name" defaultValue="Lise Noble" fullWidth />
                  <TextInput type="email" label="Email" defaultValue="lise@dino.design" fullWidth />
                  <Divider />
                  <Button variant="primary" style={{ alignSelf: 'flex-start' }}>Save changes</Button>
                </VStack>
              </Card>
            </TabPanel>

            <TabPanel value={1}>
              <Card padding="large">
                {/* `List dividers` auto-separates rows — don't also set bottomBorder. */}
                <List dividers>
                  {NOTIFICATIONS.map((n) => (
                    <ListItem
                      key={n.id}
                      secondary={n.desc}
                      endDecorator={
                        // Input control: onChange forwards a DOM event (e.target.checked).
                        <SwitchInput
                          checked={toggles[n.id as keyof typeof toggles]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToggles((t) => ({ ...t, [n.id]: e.target.checked }))}
                        />
                      }
                    >
                      {n.title}
                    </ListItem>
                  ))}
                </List>
              </Card>
            </TabPanel>
          </Tabs>
        </VStack>
      </Container>
    </Section>
  );
}
