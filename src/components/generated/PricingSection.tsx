// #1 output — generated from a prompt using dinodesign-rules.md as the spec.
// "A pricing section with three tiers, a monthly/annual toggle, feature lists."
import { useState } from 'react';
import {
  Section, Container, VStack, HStack, Grid,
  DisplaySmall, H3, Body, BodyLarge, Overline,
  Button, ButtonGroup, Card, Divider, Icon,
} from '@omni-design/components';
import CheckIcon from '@mui/icons-material/Check';

const TIERS = [
  { name: 'Starter', price: '$0', period: '/mo', blurb: 'For trying things out.',
    features: ['1 project', 'Community support', '1 GB storage'], cta: 'Get started', primary: false },
  { name: 'Pro', price: '$19', period: '/mo', blurb: 'For growing teams.',
    features: ['Unlimited projects', 'Priority support', '50 GB storage', 'Custom domains'], cta: 'Start free trial', primary: true },
  { name: 'Enterprise', price: 'Custom', period: '', blurb: 'For large orgs.',
    features: ['SSO & SAML', 'Dedicated support', 'Unlimited storage', 'Audit logs'], cta: 'Contact sales', primary: false },
];

export default function PricingSection() {
  const [billing, setBilling] = useState('annual');
  return (
    <Section surface="Surface" padding="80px 24px">
      <Container>
        <VStack gap="var(--Sizing-4)" alignItems="center">
          <VStack gap="var(--Sizing-1)" alignItems="center" style={{ textAlign: 'center' }}>
            <Overline>Pricing</Overline>
            <DisplaySmall>Plans that scale with you</DisplaySmall>
            <BodyLarge color="quiet">Start free. Upgrade when you're ready.</BodyLarge>
          </VStack>

          <ButtonGroup value={billing} onChange={setBilling} size="small">
            <Button value="monthly" size="small">Monthly</Button>
            <Button value="annual" size="small">Annual</Button>
          </ButtonGroup>

          {/* Only `Grid` is exported — MUI v1 style: container + item on the same component. */}
          <Grid container spacing={2}>
            {TIERS.map((tier) => (
              <Grid item xs={12} md={4} key={tier.name}>
                <Card padding="large">
                  <VStack gap="var(--Sizing-2)">
                    <VStack gap="var(--Sizing-Half)">
                      <H3>{tier.name}</H3>
                      <Body color="quiet">{tier.blurb}</Body>
                    </VStack>
                    <HStack gap="var(--Sizing-Half)" alignItems="baseline">
                      <DisplaySmall>{tier.price}</DisplaySmall>
                      <Body color="quiet">{tier.period}</Body>
                    </HStack>
                    <Button variant={tier.primary ? 'primary' : 'default'} fullWidth>
                      {tier.cta}
                    </Button>
                    <Divider />
                    <VStack gap="var(--Sizing-1)">
                      {tier.features.map((f) => (
                        <HStack key={f} gap="var(--Sizing-1)" alignItems="center">
                          <Icon size="small" color="success"><CheckIcon /></Icon>
                          <Body>{f}</Body>
                        </HStack>
                      ))}
                    </VStack>
                  </VStack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </VStack>
      </Container>
    </Section>
  );
}
