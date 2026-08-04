import { useState } from 'react';
import {
  Button, ButtonGroup, H2, H3, Body, BodySmall, VStack, HStack, Card, Checkbox, Divider, Chip,
} from '@dynodesign/components';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export type BillingPeriod = 'monthly' | 'annual';

export interface AddOnSelection {
  playground: boolean;
  designerPortal: boolean;
  billingPeriod: BillingPeriod;
  monthlyTotal: number;
}

export interface PurchaseSelection {
  tier: { key: string; name: string; count: number; price: number };
  addOns: AddOnSelection;
  oneTimeTotal: number;
}

const TIER = {
  key: 'single' as const,
  name: 'Design System',
  count: 1,
  price: 299,
};

const HOSTING_MONTHLY = 19;
const HOSTING_ANNUAL_MONTHLY = 15; // $15/mo billed annually ($180/yr vs $228/yr — save 21%)

const DESIGNER_PORTAL_MONTHLY = 39;
const DESIGNER_PORTAL_ANNUAL_MONTHLY = 32;

const INCLUDED = [
  'Figma library',
  'MUI component library',
  'AI integration file',
  'Interactive playground',
  'WCAG AA accessibility',
  'Light + dark mode tokens',
];

const OPTIONAL_ADD_ONS = [
  {
    key: 'designerPortal' as const,
    label: 'Designer portal',
    description: 'Fine-tune tokens, adjust components, and regenerate your system with automatic WCAG re-validation.',
    price: 39,
  },
];

interface Props {
  onCheckout: (selection: PurchaseSelection) => void;
}

export default function PricingPage({ onCheckout }: Props) {
  const [addOns, setAddOns] = useState({ designerPortal: false });
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const isAnnual = billingPeriod === 'annual';
  const hostingPrice = isAnnual ? HOSTING_ANNUAL_MONTHLY : HOSTING_MONTHLY;
  const designerPortalPrice = isAnnual ? DESIGNER_PORTAL_ANNUAL_MONTHLY : DESIGNER_PORTAL_MONTHLY;

  const monthlyTotal = hostingPrice + (addOns.designerPortal ? designerPortalPrice : 0);

  const addOnSelection: AddOnSelection = {
    playground: true,
    designerPortal: addOns.designerPortal,
    billingPeriod,
    monthlyTotal,
  };

  return (
    <VStack spacing={4} style={{ padding: '48px 24px', maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <VStack spacing={1} alignItems="center">
        <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem' }}>
          Pricing
        </BodySmall>
        <H2 style={{ textAlign: 'center' }}>Build your design system</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          One image. A complete, accessible, branded design system — live in minutes.
        </Body>
      </VStack>

      {/* Design System card */}
      <Card padding="medium" style={{ outline: '2px solid var(--Buttons-Primary-Border)', outlineOffset: -2 }}>
        <VStack spacing={2}>
          <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <BodySmall style={{ fontWeight: 700 }}>{TIER.name}</BodySmall>
            <H3 style={{ margin: 0 }}>
              ${TIER.price}
              <BodySmall component="span" style={{ color: 'var(--Quiet)', fontSize: '0.85rem', marginLeft: 4, fontWeight: 400 }}>
                one-time
              </BodySmall>
            </H3>
          </HStack>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {INCLUDED.map(f => (
              <HStack key={f} spacing={1} alignItems="center">
                <CheckCircleOutlineIcon style={{ fontSize: 16, color: 'var(--Icon-Secondary, var(--Text-Secondary))' }} />
                <BodySmall>{f}</BodySmall>
              </HStack>
            ))}
          </div>
        </VStack>
      </Card>

      {/* Billing period toggle — "Save 21%" sits as a tag above the Annual
          button so the segmented control itself stays a clean two-label pair. */}
      <VStack spacing={1} alignItems="center">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <span
            style={{
              position: 'absolute',
              top: -10,
              // Center the badge horizontally over the Annual button
              // (the right half of the segmented control). `left: 75%`
              // hits the midpoint of the right half; the transform shifts
              // the badge's own center onto that point.
              left: '75%',
              transform: 'translateX(-50%)',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--Buttons-Success-Button)',
              color: 'var(--Buttons-Success-Text)',
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              zIndex: 1,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Save 21%
          </span>
          <ButtonGroup
            size="small"
            value={billingPeriod}
            onChange={(val: 'monthly' | 'annual') => setBillingPeriod(val)}
          >
            <Button value="monthly" size="small">Monthly</Button>
            <Button value="annual" size="small">Annual</Button>
          </ButtonGroup>
        </div>
      </VStack>

      {/* Hosting (required) */}
      <Card padding="medium">
        <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <VStack spacing={0}>
            <BodySmall style={{ fontWeight: 700 }}>Hosted playground</BodySmall>
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
              Live components, code snippets, guidelines + accessibility details
            </BodySmall>
          </VStack>
          <VStack spacing={0} alignItems="flex-end" style={{ flexShrink: 0 }}>
            <HStack spacing={1} alignItems="baseline">
              {isAnnual && (
                <BodySmall style={{ textDecoration: 'line-through', color: 'var(--Quiet)', fontSize: '0.75rem' }}>
                  ${HOSTING_MONTHLY}
                </BodySmall>
              )}
              <BodySmall style={{ fontWeight: 700 }}>${hostingPrice}/mo</BodySmall>
            </HStack>
            <HStack spacing={1} alignItems="center">
              <Chip color="primary" size="small" label="Required" />
              {isAnnual && <BodySmall style={{ color: 'var(--Text-Success)', fontSize: '0.6rem', fontWeight: 600 }}>Save ${(HOSTING_MONTHLY - HOSTING_ANNUAL_MONTHLY) * 12}/yr</BodySmall>}
            </HStack>
          </VStack>
        </HStack>
      </Card>

      {/* Optional add-ons */}
      <VStack spacing={2}>
        <BodySmall style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
          Optional add-ons
        </BodySmall>
        <HStack spacing={2} style={{ alignItems: 'stretch' }}>
          {OPTIONAL_ADD_ONS.map(addon => (
            <Card
              key={addon.key}
              padding="medium"
              onClick={() => setAddOns(prev => ({ ...prev, [addon.key]: !prev[addon.key] }))}
              style={{ flex: 1, cursor: 'pointer' }}
            >
              <HStack spacing={2} style={{ alignItems: 'flex-start' }}>
                <Checkbox
                  checked={addOns[addon.key]}
                  onChange={() => setAddOns(prev => ({ ...prev, [addon.key]: !prev[addon.key] }))}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  size="small"
                />
                <VStack spacing={1} style={{ flex: 1 }}>
                  <BodySmall style={{ fontWeight: 700 }}>{addon.label}</BodySmall>
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>{addon.description}</BodySmall>
                  <HStack spacing={1} alignItems="baseline">
                    {isAnnual && (
                      <BodySmall style={{ textDecoration: 'line-through', color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                        ${addon.price}
                      </BodySmall>
                    )}
                    <BodySmall style={{ fontWeight: 600 }}>
                      +${designerPortalPrice}/mo
                    </BodySmall>
                  </HStack>
                </VStack>
              </HStack>
            </Card>
          ))}
        </HStack>
      </VStack>

      {/* Summary */}
      <Card padding="medium">
        <VStack spacing={1}>
          <HStack spacing={2} style={{ justifyContent: 'space-between' }}>
            <BodySmall>{TIER.name}</BodySmall>
            <BodySmall style={{ fontWeight: 600 }}>${TIER.price} one-time</BodySmall>
          </HStack>
          <HStack spacing={2} style={{ justifyContent: 'space-between' }}>
            <BodySmall>Playground hosting</BodySmall>
            <BodySmall>${hostingPrice}/mo</BodySmall>
          </HStack>
          {addOns.designerPortal && (
            <HStack spacing={2} style={{ justifyContent: 'space-between' }}>
              <BodySmall>Designer portal</BodySmall>
              <BodySmall>${designerPortalPrice}/mo</BodySmall>
            </HStack>
          )}
          <Divider style={{ marginTop: 4, marginBottom: 4 }} />
          <HStack spacing={2} style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: 700 }}>Due today</Body>
            <Body style={{ fontWeight: 700 }}>
              ${isAnnual ? TIER.price + (monthlyTotal * 12) : TIER.price + monthlyTotal}
            </Body>
          </HStack>
          <HStack spacing={2} style={{ justifyContent: 'space-between' }}>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              {isAnnual ? 'Then annually' : 'Then monthly'}
            </BodySmall>
            <BodySmall style={{ color: 'var(--Text-Primary)', fontWeight: 600 }}>
              {isAnnual ? `$${monthlyTotal * 12}/yr ($${monthlyTotal}/mo)` : `$${monthlyTotal}/mo`}
            </BodySmall>
          </HStack>
        </VStack>
      </Card>

      {/* CTA */}
      <Button
        variant="default"
        size="large"
        fullWidth
        style={{ fontWeight: 700, fontSize: '1rem' }}
        onClick={() => onCheckout({ tier: TIER, addOns: addOnSelection, oneTimeTotal: TIER.price })}
        endIcon={<ArrowForwardIcon />}
      >
        Get started with OmniDesign
      </Button>

      <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center', fontSize: '0.7rem' }}>
        Tokens and CSS are hosted — no raw file downloads. Playground subscription required for all plans.
      </BodySmall>
    </VStack>
  );
}
