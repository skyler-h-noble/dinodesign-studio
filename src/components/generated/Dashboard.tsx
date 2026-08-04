// #1 output — generated from a prompt using dinodesign-rules.md as the spec.
// "A dashboard with a top nav, stat cards, a notice, and a recent-customers table."
import {
  Section, Container, VStack, HStack, Grid,
  AppBar, Card, Overline, DisplaySmall, H2, Body, Caption,
  Table, Chip, Alert, Icon,
} from '@dynodesign/components';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const STATS = [
  { label: 'Active customers', value: '1,284', delta: '+12% this month' },
  { label: 'MRR',             value: '$48.2k', delta: '+4.1% this month' },
  { label: 'Churn',           value: '1.8%',   delta: '-0.3% this month' },
];

// Table: columns can be plain strings; rows are arrays of cells (a cell may be JSX).
const COLUMNS = ['Customer', 'Plan', 'Status', 'MRR'];
const ROWS = [
  ['Acme Inc.', 'Enterprise', <Chip variant="success-light">Active</Chip>,   '$1,900'],
  ['Globex',    'Pro',        <Chip variant="success-light">Active</Chip>,   '$190'],
  ['Initech',   'Pro',        <Chip variant="warning-light">Past due</Chip>, '$190'],
  ['Umbrella',  'Starter',    <Chip variant="neutral-light">Trial</Chip>,    '$0'],
];

export default function Dashboard() {
  return (
    <VStack gap="0">
      {/* AppBar paints its own theme; keep it OUTSIDE the Section's surface. */}
      <AppBar companyName="Dino" navLinks={['Dashboard', 'Customers', 'Reports']} />

      <Section surface="Surface" padding="32px 24px">
        <Container>
          <VStack gap="var(--Sizing-3)">
            <VStack gap="var(--Sizing-Half)">
              <H2>Dashboard</H2>
              <Body color="quiet">Your account at a glance.</Body>
            </VStack>

            <Alert color="info">You have 3 invoices awaiting payment.</Alert>

            <Grid container spacing={2}>
              {STATS.map((s) => (
                <Grid item xs={12} md={4} key={s.label}>
                  <Card padding="large">
                    <VStack gap="var(--Sizing-Half)">
                      <Overline>{s.label}</Overline>
                      <DisplaySmall>{s.value}</DisplaySmall>
                      <HStack gap="var(--Sizing-Half)" alignItems="center">
                        <Icon size="small" color="success"><TrendingUpIcon /></Icon>
                        <Caption color="quiet">{s.delta}</Caption>
                      </HStack>
                    </VStack>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card padding="large">
              <VStack gap="var(--Sizing-2)">
                <H2>Recent customers</H2>
                <Table columns={COLUMNS} rows={ROWS} stripe="odd" />
              </VStack>
            </Card>
          </VStack>
        </Container>
      </Section>
    </VStack>
  );
}
