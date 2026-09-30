/**
 * A live example per component, rendered in the user's own design system.
 *
 * This is the point of the docs page: a prop table describes a component, an
 * example shows the one the user actually has — their radius, their type,
 * their palette. The uuid in /docs/:uuid/:component is what makes that
 * possible, and it is why the page is per design system rather than shared.
 *
 * Not every component gets one. A Modal or a Drawer needs open state and a
 * portal, and a half-working example is worse than none — it teaches a shape
 * that does not run. Those fall through to the props table, which is honest.
 *
 * Tag, Loader and Rating are absent for a different reason: the studio has
 * @omni-design/components 0.7.10 installed while the published library is
 * 0.11.0, and those three do not exist in 0.7.10. So an example here renders
 * the user's TOKENS through a four-version-old COMPONENT — a Tabs example
 * would not show the baseline, because that shipped in 0.11.0. Upgrading the
 * studio is the fix; until then the gap is real and worth knowing about.
 */
import React from 'react';
import {
  Button, Chip, Badge, Alert, Card, Avatar, Icon, Link, Divider,
  Checkbox, Radio, RadioGroup, SwitchInput, Slider, Input, Breadcrumbs,
  Pagination, Tabs, TabList, Tab, TabPanel, ButtonGroup, Accordion,
  Body, H3, VStack, HStack,
} from '@omni-design/components';

/** Rendered inside the provider, so every token resolves to the user's brand. */
export const EXAMPLES: Record<string, () => React.ReactElement> = {
  Button: () => (
    <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
      <Button>Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="primary-outline">Outline</Button>
      <Button variant="primary-ghost">Ghost</Button>
      <Button disabled>Disabled</Button>
    </HStack>
  ),
  ButtonGroup: () => (
    <ButtonGroup value="a" onChange={() => {}} size="small">
      <Button value="a" size="small">Day</Button>
      <Button value="b" size="small">Week</Button>
      <Button value="c" size="small">Month</Button>
    </ButtonGroup>
  ),
  Chip: () => (
    <HStack gap="var(--Sizing-1)">
      <Chip label="Unselected" />
      <Chip label="Selected" selected />
      <Chip label="Dismissible" onDelete={() => {}} />
    </HStack>
  ),
  Badge: () => (
    <HStack gap="var(--Sizing-3)">
      <Badge badgeContent={3}><Icon><span>✉</span></Icon></Badge>
      <Badge dot><Icon><span>🔔</span></Icon></Badge>
    </HStack>
  ),
  Alert: () => (
    <VStack gap="var(--Sizing-1)">
      <Alert color="info">Something worth knowing.</Alert>
      <Alert color="error">Something went wrong.</Alert>
    </VStack>
  ),
  Card: () => (
    <Card padding="medium">
      <VStack gap="var(--Sizing-1)">
        <H3>Card title</H3>
        <Body>What a card looks like in this design system.</Body>
      </VStack>
    </Card>
  ),
  Avatar: () => (
    <HStack gap="var(--Sizing-1)">
      <Avatar initials="LN" />
      <Avatar />
    </HStack>
  ),
  Icon: () => (
    <HStack gap="var(--Sizing-1)">
      <Icon color="primary"><span>★</span></Icon>
      <Icon color="success"><span>✓</span></Icon>
      <Icon color="error"><span>✕</span></Icon>
    </HStack>
  ),
  Link: () => <Link href="#example">A link, which thickens rather than recolours on hover</Link>,
  Divider: () => <Divider indicatorText="OR" />,
  Checkbox: () => (
    <VStack gap="var(--Sizing-Half)">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" indeterminate />
    </VStack>
  ),
  Radio: () => (
    <RadioGroup defaultValue="a" name="docs-radio">
      <Radio value="a" label="First" />
      <Radio value="b" label="Second" />
    </RadioGroup>
  ),
  SwitchInput: () => (
    <VStack gap="var(--Sizing-Half)">
      <SwitchInput label="Off" />
      <SwitchInput label="On" defaultChecked />
    </VStack>
  ),
  Slider: () => <Slider defaultValue={40} />,
  Input: () => <Input label="Email" placeholder="you@example.com" />,
  Breadcrumbs: () => (
    <Breadcrumbs>
      <Link href="#a">Home</Link>
      <Link href="#b">Products</Link>
      <Body>Current</Body>
    </Breadcrumbs>
  ),
  Pagination: () => <Pagination count={8} defaultPage={3} />,
  Accordion: () => (
    <Accordion>
      <Body>An accordion segment, open.</Body>
    </Accordion>
  ),
  Tabs: () => (
    <Tabs defaultValue={0}>
      <TabList>
        <Tab value={0}>Overview</Tab>
        <Tab value={1}>Details</Tab>
      </TabList>
      <TabPanel value={0}><Body>The first panel.</Body></TabPanel>
      <TabPanel value={1}><Body>The second panel.</Body></TabPanel>
    </Tabs>
  ),
};

export function hasExample(component: string): boolean {
  return component in EXAMPLES;
}
