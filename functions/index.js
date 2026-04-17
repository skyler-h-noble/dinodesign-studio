/**
 * Firebase Cloud Functions for DinoDesign
 *
 * createCheckoutSession — creates a Stripe Checkout Session
 * handleStripeWebhook — processes Stripe webhook events
 *
 * Deploy: firebase deploy --only functions --project dino-design
 *
 * Stripe setup:
 *   1. Create products + prices in Stripe Dashboard
 *   2. Set secrets: firebase functions:secrets:set STRIPE_SECRET_KEY
 *   3. After deploy, create webhook endpoint in Stripe pointing to handleStripeWebhook URL
 *   4. Set webhook secret: firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 */

const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Stripe Price IDs — create these in your Stripe Dashboard:
 *
 * ONE-TIME prices (Product → Add price → "One time"):
 *   - Single project: $299
 *   - 3-project bundle: $799
 *   - 10-project bundle: $2,499
 *
 * RECURRING prices (Product → Add price → "Recurring" → Monthly):
 *   - Playground hosting: $19/mo
 *   - Storybook: $12/mo
 *   - Designer portal: $39/mo
 *
 * Replace the placeholder IDs below with your actual Stripe price IDs.
 */
const PRICES = {
  // One-time credit purchases (TEST MODE)
  single:         'price_1TLQ6Z3oOTDXzvIpDEYBJipH',
  bundle3:        'price_1TLQ6Z3oOTDXzvIpDEYBJipH',  // TODO: create separate 3-pack price
  bundle10:       'price_1TLQ6Z3oOTDXzvIpDEYBJipH',  // TODO: create separate 10-pack price

  // Monthly recurring subscriptions (TEST MODE)
  playground:     'price_1TLQ7A3oOTDXzvIpjbDssWFf',
  storybook:      'price_1TLQ7A3oOTDXzvIpjbDssWFf',  // TODO: create separate storybook price
  designerPortal: 'price_1TLQ7A3oOTDXzvIpjbDssWFf',  // TODO: create separate designer portal price
};

// How many credits each tier gives
const CREDIT_MAP = {
  single: 1,
  bundle3: 3,
  bundle10: 10,
};

/**
 * createCheckoutSession
 *
 * Called from the client. Creates a Stripe Checkout Session that combines:
 *   - A one-time charge for the project credits (on first invoice only)
 *   - A monthly subscription for hosting + optional add-ons
 *
 * The customer sees one clean checkout:
 *   3-project bundle        $799.00  (one-time)
 *   Playground hosting       $19.00/mo
 *   ─────────────────────────────
 *   Due today               $818.00
 *   Then $19.00/month
 */
exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey], cors: true },
  async (request) => {
    const { tierKey, addOns, userId, successUrl, cancelUrl } = request.data;

    if (!userId || !tierKey) {
      throw new Error('Missing required fields: userId, tierKey');
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecretKey.value());

    // Build line items — mix one-time + recurring in subscription mode.
    // Stripe puts one-time prices on the first invoice only.
    const lineItems = [];

    // One-time: project credits
    lineItems.push({ price: PRICES[tierKey], quantity: 1 });

    // Recurring: playground hosting (always required)
    if (addOns?.playground !== false) {
      lineItems.push({ price: PRICES.playground, quantity: 1 });
    }

    // Recurring: optional add-ons
    if (addOns?.storybook) {
      lineItems.push({ price: PRICES.storybook, quantity: 1 });
    }
    if (addOns?.designerPortal) {
      lineItems.push({ price: PRICES.designerPortal, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      subscription_data: {
        metadata: {
          userId,
          tierKey,
          credits: String(CREDIT_MAP[tierKey] || 1),
        },
      },
      metadata: {
        userId,
        tierKey,
        credits: String(CREDIT_MAP[tierKey] || 1),
      },
    });

    return { url: session.url };
  }
);

/**
 * handleStripeWebhook
 *
 * Receives Stripe webhook events and updates Firestore.
 *
 * Set up in Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL: https://<region>-dino-design.cloudfunctions.net/handleStripeWebhook
 *   Events: checkout.session.completed, invoice.paid, customer.subscription.deleted
 */
exports.handleStripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeSecretKey.value());

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const db = admin.firestore();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId || session.client_reference_id;
        const credits = parseInt(session.metadata?.credits || '1', 10);
        const tierKey = session.metadata?.tierKey || 'single';

        if (userId) {
          // Add credits to user
          await db.collection('users').doc(userId).set(
            { credits: admin.firestore.FieldValue.increment(credits) },
            { merge: true }
          );

          // Record the payment
          await db.collection('payments').add({
            userId,
            date: admin.firestore.Timestamp.now(),
            description: `${tierKey} — ${credits} credit${credits > 1 ? 's' : ''}`,
            amount: session.amount_total || 0,
            status: 'paid',
            type: 'checkout',
            stripeSessionId: session.id,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });

          console.log(`Added ${credits} credits to user ${userId}`);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId && !invoice.metadata?.isFirstInvoice) {
          const paymentSnap = await db.collection('payments')
            .where('stripeSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

          if (!paymentSnap.empty) {
            const userId = paymentSnap.docs[0].data().userId;

            await db.collection('payments').add({
              userId,
              date: admin.firestore.Timestamp.now(),
              description: 'Monthly subscription',
              amount: invoice.amount_paid || 0,
              status: 'paid',
              type: 'subscription',
              stripeInvoiceId: invoice.id,
              stripeSubscriptionId: subscriptionId,
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        if (userId) {
          const dsSnap = await db.collection('designSystems')
            .where('userId', '==', userId)
            .where('stripeSubscriptionId', '==', subscription.id)
            .get();

          dsSnap.forEach(async (d) => {
            await d.ref.update({ plan: 'cancelled' });
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    res.json({ received: true });
  }
);
