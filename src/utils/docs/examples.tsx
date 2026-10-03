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
 * The Input example imports TEXTINPUT, not Input. The package publishes the
 * component under that name — `export { Input as TextInput }`, which the
 * library's index calls the preferred one — while the doc entry, the Figma page
 * and figmaComponentMap all still say "Input". Importing `Input` here threw at
 * RUNTIME ("does not provide an export named 'Input'") and took the whole docs
 * page down, not just this example.
 *
 * TypeScript could not have caught it: src/types/dynodesign.d.ts `declare
 * module`s the package, and a declared module REPLACES the real types, so the
 * compiler stopped being able to tell the truth about what the package exports.
 * That is the AvatarMenu warning in this repo's CLAUDE.md, played out.
 *
 * Tag and Loader still have no example. They were missing from the library's
 * index entirely and have been added, but the studio installs the PUBLISHED
 * package — so they arrive here on the next release, not before.
 */
import React from 'react';
import {
  Button, Chip, Badge, Alert, Card, Avatar, Icon, Link, Divider,
  Checkbox, Radio, RadioGroup, SwitchInput, Slider, Rating, TextInput, Breadcrumbs,
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
  Link: () => <Link href="#example">A link, which thickens rather than recolors on hover</Link>,
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
  Input: () => <TextInput label="Email" placeholder="you@example.com" />,
  SwitchInput: () => (
    <VStack gap="var(--Sizing-Half)">
      <SwitchInput label="Off" />
      <SwitchInput label="On" defaultChecked />
    </VStack>
  ),
  Slider: () => <Slider defaultValue={40} />,
  Rating: () => <Rating defaultValue={3} />,
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
