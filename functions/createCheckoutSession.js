/**
 * Firebase Cloud Function: createCheckoutSession
 *
 * Called from the client to create a Stripe Checkout Session.
 * Deploy with: firebase deploy --only functions
 *
 * Required environment variables (set via Firebase CLI):
 *   firebase functions:config:set stripe.secret_key="sk_live_..."
 *   firebase functions:config:set stripe.webhook_secret="whsec_..."
 *
 * Or for Firebase Gen2 functions, use .env in the functions/ directory.
 */

const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// Stripe price IDs — create these in your Stripe Dashboard
const PRICE_MAP = {
  single:         'price_REPLACE_WITH_SINGLE_PRICE_ID',       // $299 one-time
  bundle3:        'price_REPLACE_WITH_BUNDLE3_PRICE_ID',      // $799 one-time
  bundle10:       'price_REPLACE_WITH_BUNDLE10_PRICE_ID',     // $2,499 one-time
  playground:     'price_REPLACE_WITH_PLAYGROUND_PRICE_ID',   // $19/mo recurring
  designerPortal: 'price_REPLACE_WITH_DESIGNER_PORTAL_ID',    // $39/mo recurring
};

const CREDIT_MAP = {
  single: 1,
  bundle3: 3,
  bundle10: 10,
};

/**
 * createCheckoutSession — callable function
 * Creates a Stripe Checkout Session and returns the URL.
 */
exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const { tierKey, addOns, userId, successUrl, cancelUrl } = request.data;

    if (!userId || !tierKey) {
      throw new Error('Missing required fields: userId, tierKey');
    }

    const stripe = new Stripe(stripeSecretKey.value());

    // Build line items
    const lineItems = [];

    // One-time credit purchase
    lineItems.push({
      price: PRICE_MAP[tierKey],
      quantity: 1,
    });

    // Monthly subscriptions
    if (addOns?.playground) {
      lineItems.push({ price: PRICE_MAP.playground, quantity: 1 });
    }
    if (addOns?.designerPortal) {
      lineItems.push({ price: PRICE_MAP.designerPortal, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', // subscription mode handles both one-time and recurring
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
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
 * handleStripeWebhook — HTTP function (not callable)
 * Receives Stripe webhook events and updates Firestore.
 *
 * Set up in Stripe Dashboard → Webhooks → Add endpoint:
 *   URL: https://{region}-{project}.cloudfunctions.net/handleStripeWebhook
 *   Events: checkout.session.completed
 */
exports.handleStripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const credits = parseInt(session.metadata?.credits || '1', 10);
      const tierKey = session.metadata?.tierKey || 'single';

      if (userId) {
        const db = admin.firestore();

        // Add credits
        await db.collection('users').doc(userId).set(
          { credits: admin.firestore.FieldValue.increment(credits) },
          { merge: true }
        );

        // Record payment
        await db.collection('payments').add({
          userId,
          date: admin.firestore.Timestamp.now(),
          description: `${tierKey} — ${credits} credit${credits > 1 ? 's' : ''}`,
          amount: session.amount_total, // in cents
          status: 'paid',
          stripeSessionId: session.id,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        });

        console.log(`Added ${credits} credits to user ${userId}`);
      }
    }

    res.json({ received: true });
  }
);
