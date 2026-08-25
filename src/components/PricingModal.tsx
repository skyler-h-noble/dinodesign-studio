import { useState } from 'react';
import {
  Modal, Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Checkbox, Divider,
} from '@omni-design/components';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface Props {
  open: boolean;
  onClose: () => void;
  credits: number;
  onUseCredit: (addOns: AddOnSelection) => void;
  onBuyCredits: (selection: PurchaseSelection) => void;
}

export interface AddOnSelection {
  playground: boolean; // always true (required)
  designerPortal: boolean;
  monthlyTotal: number;
}

export interface PurchaseSelection {
  tier: typeof TIERS[number];
  addOns: AddOnSelection;
  oneTimeTotal: number;
}

// `as const` so each tier's `key` keeps its literal type. Without it the
// element type widens and selection.tier.key reaches redirectToCheckout as a
// bare string, where the parameter is 'single' | 'bundle3' | 'bundle10'.
const TIERS = [
  {
    key: 'single' as const,
    name: 'Single project',
    count: 1 as const,
    price: 299,
    perProject: 299,
    popular: false,
    features: ['Figma library', 'MUI component library', 'AI integration file', 'Interactive playground'],
  },
  {
    key: 'bundle3' as const,
    name: '3-project bundle',
    count: 3 as const,
    price: 799,
    perProject: 266,
    popular: true,
    features: ['Everything in single', '16% savings per project', '3 independent systems'],
  },
  {
    key: 'bundle10' as const,
    name: '10-project bundle',
    count: 10 as const,
    price: 2499,
    perProject: 250,
    popular: false,
    features: ['Everything in single', '33% savings per project', 'Best for agencies'],
  },
] as const;

const HOSTING_PRICE = 19;

const OPTIONAL_ADD_ONS = [
  {
    key: 'designerPortal' as const,
    label: 'Designer portal',
    description: 'Fine-tune tokens, adjust components, and regenerate your system with automatic WCAG re-validation.',
    price: 39,
  },
];

type Step = 'choose' | 'addons';

export default function PricingModal({ open, onClose, credits, onUseCredit, onBuyCredits }: Props) {
  const [step, setStep] = useState<Step>(credits > 0 ? 'addons' : 'choose');
  const [selectedTier, setSelectedTier] = useState(1);
  const [useExistingCredit, setUseExistingCredit] = useState(credits > 0);
  const [addOns, setAddOns] = useState({ designerPortal: false });

  // Reset when modal opens
  const handleClose = () => {
    setStep(credits > 0 ? 'addons' : 'choose');
    setUseExistingCredit(credits > 0);
    setAddOns({ designerPortal: false });
    onClose();
  };

  const tier = TIERS[selectedTier];
  const monthlyTotal = HOSTING_PRICE + (addOns.designerPortal ? 39 : 0);

  const addOnSelection: AddOnSelection = {
    playground: true,
    designerPortal: addOns.designerPortal,
    monthlyTotal,
  };

  // ─── Step 1: Choose tier (only shown when no credits) ───
  if (step === 'choose') {
    return (
      <Modal open={open} onClose={handleClose} title="">
        <VStack spacing={4} style={{ maxWidth: 780, width: '100%' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem' }}>
              Pricing
            </BodySmall>
            <H2 style={{ textAlign: 'center' }}>Build your design system</H2>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
              One image. A complete, accessible, branded design system.
            </Body>
          </VStack>

          {credits > 0 && (
            <Card padding="small" style={{ width: '100%' }}>
              <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Body>You have <strong>{credits} credit{credits !== 1 ? 's' : ''}</strong></Body>
                <Button variant="default" size="small" onClick={() => { setUseExistingCredit(true); setStep('addons'); }}>
                  Use a credit
                </Button>
              </HStack>
            </Card>
          )}

          <VStack spacing={2} style={{ width: '100%' }}>
            <BodySmall style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
              1. Choose a project tier
            </BodySmall>

            <HStack spacing={2} style={{ width: '100%', alignItems: 'stretch' }}>
              {TIERS.map((t, i) => {
                const isSelected = selectedTier === i;
                return (
                  <Card
                    key={t.key}
                    padding="medium"
                    onClick={() => setSelectedTier(i)}
                    style={{
                      flex: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      outline: isSelected ? '2px solid #3b82f6' : 'none',
                      outlineOffset: -2,
                    }}
                  >
                    {t.popular && (
                      <span style={{
                        position: 'absolute', top: -1, left: 12,
                        padding: '2px 10px', borderRadius: '0 0 6px 6px',
                        background: '#3b82f6', color: '#fff',
                        fontSize: '0.6rem', fontWeight: 700,
                      }}>
                        Most popular
                      </span>
                    )}
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <CheckCircleIcon style={{ fontSize: 22, color: '#3b82f6' }} />
                      </div>
                    )}
                    <VStack spacing={1}>
                      <BodySmall style={{ fontWeight: 700 }}>{t.name}</BodySmall>
                      <div>
                        <span style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>
                          ${t.price.toLocaleString()}
                        </span>
                        <span style={{ color: 'var(--Quiet)', fontSize: '0.85rem', marginLeft: 4 }}>one-time</span>
                      </div>
                      <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                        {t.count > 1 ? `$${t.perProject}/project · ` : ''}+ ${HOSTING_PRICE}/mo each
                      </BodySmall>
                      <VStack spacing={0} style={{ marginTop: 8 }}>
                        {t.features.map(f => (
                          <HStack key={f} spacing={1} alignItems="center">
                            <CheckCircleIcon style={{ fontSize: 16, color: '#3b82f6' }} />
                            <BodySmall style={{ fontSize: '0.75rem' }}>{f}</BodySmall>
                          </HStack>
                        ))}
                      </VStack>
                    </VStack>
                  </Card>
                );
              })}
            </HStack>
          </VStack>

          <Button
            variant="default"
            size="large"
            style={{ width: '100%', background: '#3b82f6', color: '#fff', fontWeight: 700 }}
            sx={{ '&:hover': { background: '#2563eb' } }}
            onClick={() => { setUseExistingCredit(false); setStep('addons'); }}
            endIcon={<ArrowForwardIcon />}
          >
            Continue
          </Button>
        </VStack>
      </Modal>
    );
  }

  // ─── Step 2: Add-ons + confirm ───
  return (
    <Modal open={open} onClose={handleClose} title="">
      <VStack spacing={4} style={{ maxWidth: 600, width: '100%' }}>
        <VStack spacing={1} alignItems="center">
          <H2 style={{ textAlign: 'center' }}>
            {useExistingCredit ? 'Use a credit' : 'Choose your add-ons'}
          </H2>
          <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
            {useExistingCredit
              ? `You have ${credits} credit${credits !== 1 ? 's' : ''}. Using 1 for this design system.`
              : `${tier.name} — $${tier.price.toLocaleString()} one-time`}
          </Body>
        </VStack>

        {/* Hosting (always included) */}
        <Card padding="medium" style={{ width: '100%', border: '2px solid #3b82f6' }}>
          <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <VStack spacing={0}>
              <BodySmall style={{ fontWeight: 700 }}>Hosted playground</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                Live components, code snippets, guidelines + accessibility details
              </BodySmall>
            </VStack>
            <VStack spacing={0} alignItems="flex-end">
              <BodySmall style={{ fontWeight: 700 }}>${HOSTING_PRICE}/mo</BodySmall>
              <BodySmall style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600 }}>Required</BodySmall>
            </VStack>
          </HStack>
        </Card>

        {/* Optional add-ons */}
        <VStack spacing={2} style={{ width: '100%' }}>
          <BodySmall style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Optional add-ons
          </BodySmall>
          <HStack spacing={2} style={{ width: '100%', alignItems: 'stretch' }}>
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
                    <BodySmall style={{ fontWeight: 600 }}>+${addon.price}/month</BodySmall>
                  </VStack>
                </HStack>
              </Card>
            ))}
          </HStack>
        </VStack>

        {/* Summary */}
        <Card padding="medium" style={{ width: '100%' }}>
          <VStack spacing={1} style={{ width: '100%' }}>
            {useExistingCredit ? (
              <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%' }}>
                <BodySmall>1 credit</BodySmall>
                <BodySmall style={{ fontWeight: 600 }}>Free</BodySmall>
              </HStack>
            ) : (
              <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%' }}>
                <BodySmall>{tier.name}</BodySmall>
                <BodySmall style={{ fontWeight: 600 }}>${tier.price.toLocaleString()} one-time</BodySmall>
              </HStack>
            )}
            <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%' }}>
              <BodySmall>Playground hosting</BodySmall>
              <BodySmall>${HOSTING_PRICE}/mo</BodySmall>
            </HStack>
            {addOns.designerPortal && (
              <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%' }}>
                <BodySmall>Designer portal</BodySmall>
                <BodySmall>$39/mo</BodySmall>
              </HStack>
            )}
            <Divider style={{ marginTop: 4 }} />
            <HStack spacing={2} style={{ justifyContent: 'space-between', width: '100%', paddingTop: 4 }}>
              <Body style={{ fontWeight: 700 }}>Monthly subscription</Body>
              <Body style={{ fontWeight: 700, color: '#3b82f6' }}>${monthlyTotal}/mo</Body>
            </HStack>
          </VStack>
        </Card>

        {/* CTA */}
        <Button
          variant="default"
          size="large"
          style={{ width: '100%', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '1rem' }}
          sx={{ '&:hover': { background: '#2563eb' } }}
          onClick={() => {
            if (useExistingCredit) {
              onUseCredit(addOnSelection);
            } else {
              onBuyCredits({ tier, addOns: addOnSelection, oneTimeTotal: tier.price });
            }
          }}
        >
          {useExistingCredit ? 'Use credit & get started' : 'Get started with OmniDesign'}
        </Button>

        {/* Back link if user has credits but is on buy flow */}
        {!useExistingCredit && credits > 0 && (
          <BodySmall style={{ textAlign: 'center' }}>
            <span
              style={{ color: '#3b82f6', cursor: 'pointer' }}
              onClick={() => setUseExistingCredit(true)}
            >
              Use a credit instead
            </span>
          </BodySmall>
        )}
        {useExistingCredit && (
          <BodySmall style={{ textAlign: 'center' }}>
            <span
              style={{ color: '#3b82f6', cursor: 'pointer' }}
              onClick={() => { setStep('choose'); setUseExistingCredit(false); }}
            >
              Buy more credits instead
            </span>
          </BodySmall>
        )}

        <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center', fontSize: '0.7rem' }}>
          Tokens and CSS are hosted — no raw file downloads. Playground subscription required for all plans.
        </BodySmall>
      </VStack>
    </Modal>
  );
}
