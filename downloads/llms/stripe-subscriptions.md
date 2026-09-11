# Stripe Subscriptions: Practical Implementation Patterns

> Sources: Stripe Documentation, RetryHero Best Practices Guide (2026), James Ross Jr. Implementation Guide, buildmvpfast.com Metered Billing Guide

---

## Core Architecture

### Data Model: Mirror Stripe in Your Database

**Critical principle:** Never query the Stripe API at runtime to check subscription status. Mirror state in your database via webhooks.

```sql
-- customers
id, user_id, stripe_customer_id, created_at

-- subscriptions
id, customer_id, stripe_subscription_id, status, plan_id,
current_period_start, current_period_end, cancel_at_period_end,
canceled_at, trial_end, created_at, updated_at

-- subscription_items
id, subscription_id, stripe_subscription_item_id, stripe_price_id,
quantity, created_at

-- invoices
id, customer_id, subscription_id, stripe_invoice_id, status,
amount_due, amount_paid, currency, period_start, period_end,
paid_at, created_at
```

**Feature gating query:**
```sql
WHERE subscriptions.status = 'active'
  AND subscriptions.customer_id = ?
```

### Products vs. Prices Model

One Product per plan tier. Multiple Prices per Product (monthly, annual, currency variants). Archive old Prices -- never create new Products for pricing changes.

```
Product: "Pro Plan"
  +-- Price: $29/month (active)
  +-- Price: $290/year (active)
  +-- Price: $19/month (archived -- legacy)
```

### Subscription Lifecycle States

| Status | Meaning | App Behavior |
|--------|---------|--------------|
| `trialing` | Free trial period | Full access |
| `active` | Paid and current | Full access |
| `past_due` | Payment failed, grace period | Degraded experience, recovery workflow |
| `unpaid` | All retries exhausted | Restrict access fully |
| `canceled` | Terminated | No access, offer data export |
| `paused` | Temporarily suspended | Limited access |
| `incomplete` | Initial payment pending | No access |

**Grace period:** 14-21 days for `past_due` is the B2B SaaS industry standard.

---

## Subscription Creation Flow

### Step 1: Create Stripe Customer on Signup

```typescript
const customer = await stripe.customers.create({
  email: user.email,
  metadata: {
    app_user_id: user.id,
    signup_source: 'web',
  },
});

await db.users.update({
  where: { id: user.id },
  data: { stripe_customer_id: customer.id },
});
```

### Step 2: Create Checkout Session

```typescript
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: 'subscription',
  line_items: [{
    price: priceId,  // e.g., 'price_pro_monthly'
    quantity: 1,
  }],
  success_url: `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${APP_URL}/billing/cancel`,
  subscription_data: {
    trial_period_days: 14,
    metadata: {
      feature_flags: 'advanced_analytics,api_access',
      onboarded_at: new Date().toISOString(),
    },
  },
  metadata: {
    plan_tier: 'pro',
    company_size: '11-50',
  },
});
```

### Step 3: Handle Webhook on Completion

```typescript
// checkout.session.completed
// invoice.paid
// -> Create subscription record in your database
```

---

## Webhook Implementation

### Essential Events to Handle

| Event | Purpose |
|-------|---------|
| `customer.subscription.created` | Mirror new subscription to DB |
| `customer.subscription.updated` | Handle plan changes, trial extensions, quantity changes |
| `customer.subscription.deleted` | Mark subscription as canceled |
| `invoice.paid` | Mark invoice as paid, update current_period_end |
| `invoice.payment_failed` | Begin dunning process, show user payment prompt |
| `invoice.payment_action_required` | 3DS authentication required |
| `customer.subscription.trial_will_end` | Trigger reminder 3 days before trial ends |

### Webhook Handler with Idempotency

```typescript
import express from 'express';
import stripe from 'stripe';

const router = express.Router();

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency check -- store processed event IDs
  const alreadyProcessed = await db.webhookEvents.findUnique({
    where: { stripeEventId: event.id },
  });
  if (alreadyProcessed) {
    return res.status(200).json({ received: true });
  }

  // Record event as processed
  await db.webhookEvents.create({
    data: { stripeEventId: event.id, type: event.type },
  });

  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'customer.subscription.trial_will_end':
      await handleTrialEnding(event.data.object);
      break;
  }

  res.status(200).json({ received: true });
});
```

---

## Payment Failure Recovery Stack

### Three-Layer Recovery System

| Layer | What It Recovers | Cumulative Rate |
|-------|-----------------|-----------------|
| Smart Retries | Soft declines (timing issues) | ~15% |
| + Dunning emails | Customers who act on reminders | ~40% |
| + Card update pages | Hard declines (new payment method) | ~60% |

### Smart Retries Configuration

Enable in Stripe Dashboard > Billing > Subscriptions. Uses ML to determine optimal retry timing. Free and effective for soft declines.

### Dunning Email Sequence (4-5 emails over 14-21 days)

| Day | Purpose | Content |
|-----|---------|---------|
| 0 (immediate) | Friendly heads-up | "Your payment didn't go through -- here's a link to update your card." |
| 3 | Helpful reminder | Direct link to resolve |
| 7 | Urgency | "Your account will be downgraded in 7 days" |
| 12 | Last chance | Clear deadline, clear consequence |
| 14-21 | Final notice | Before cancellation |

**Each email must include:** subscriber name, plan name, amount due, one-click link to update payment method.

### Card Update Page Conversion Rates

| Type | Conversion |
|------|-----------|
| Generic "update your billing" emails | 2-5% |
| Branded card update page with direct link | 12-18% |
| Personalized page with plan details + deadline | 20-25% |

### Payment Failure Flow Implementation

```typescript
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // 1. Update invoice status in database
  await db.invoices.update({
    where: { stripe_invoice_id: invoice.id },
    data: { status: 'failed' },
  });

  // 2. Get customer info
  const subscription = await db.subscriptions.findFirst({
    where: { stripe_subscription_id: invoice.subscription as string },
    include: { customer: { include: { user: true } } },
  });

  // 3. Show in-app banner
  await redis.setex(
    `payment_failed:${subscription.customer.user_id}`,
    86400 * 14, // 14 days
    JSON.stringify({ invoiceId: invoice.id, amount: invoice.amount_due })
  );

  // 4. Send immediate email
  await emailService.send({
    to: subscription.customer.user.email,
    template: 'payment-failed',
    data: {
      customerName: subscription.customer.user.name,
      planName: subscription.plan.name,
      amount: formatCurrency(invoice.amount_due, invoice.currency),
      updateUrl: generateCardUpdateUrl(subscription.customer.id),
    },
  });
}
```

---

## Plan Changes and Prorations

### Upgrades (Immediate)

Default behavior: immediately apply new plan, charge prorated difference.

```typescript
await stripe.subscriptions.update(subscriptionId, {
  items: [{
    id: existingItemId,
    price: newPriceId,
  }],
  proration_behavior: 'create_prorations',
});
```

### Downgrades (Scheduled)

Schedule change to end of current billing period to avoid awkward credit-then-charge UX.

```typescript
await stripe.subscriptions.update(subscriptionId, {
  items: [{
    id: itemId,
    price: newPriceId,
  }],
  proration_behavior: 'none',
  billing_cycle_anchor: 'unchanged',
});
```

---

## Trial Management

### Best Practices

1. **Capture card at trial start** -- users who don't provide a card are far less likely to convert
2. **Trial extension** -- one-line API call (`trial_end: newTimestamp`) but update email and local record
3. **Trial-to-paid conversion** -- Stripe auto-creates first invoice; `invoice.paid` webhook triggers full activation
4. **Free tier vs. trial** -- Free tier = permanent limited features ($0 plan or no subscription); Trial = temporary full access (subscription with `trial_end`)

### Trial-to-Paid Conversion Handler

```typescript
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscription = await db.subscriptions.findFirst({
    where: { stripe_subscription_id: invoice.subscription as string },
  });

  if (subscription.status === 'trialing') {
    // Trial just converted to paid
    await sendWelcomeToPaidEmail(subscription);
  }

  await db.subscriptions.update({
    where: { id: subscription.id },
    data: {
      status: 'active',
      current_period_end: new Date(invoice.period_end * 1000),
    },
  });

  await db.invoices.create({
    customer_id: subscription.customer_id,
    subscription_id: subscription.id,
    stripe_invoice_id: invoice.id,
    status: 'paid',
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency,
    period_start: new Date(invoice.period_start * 1000),
    period_end: new Date(invoice.period_end * 1000),
    paid_at: new Date(invoice.status_transitions.paid_at * 1000),
  });
}
```

---

## Customer Portal

### Implementation

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${APP_URL}/settings/billing`,
});

// Redirect user to session.url
```

**Reduces payment-related support tickets by 40-60%.**

Configure to allow: payment method updates, plan switching, invoice history.

---

## Metadata Strategy

### Customer Metadata

```json
{
  "app_user_id": "usr_abc123",
  "signup_source": "blog-post-9",
  "plan_tier": "pro",
  "company_size": "11-50"
}
```

### Subscription Metadata

```json
{
  "feature_flags": "advanced_analytics,api_access",
  "onboarded_at": "2026-04-01",
  "account_manager": "none"
}
```

---

## MRR and Churn Metrics

### Key Metrics to Track

| Metric | Formula |
|--------|---------|
| MRR | Monthly Recurring Revenue (net of churn + expansion) |
| Gross churn rate | Total MRR lost / starting MRR |
| Involuntary churn rate | MRR lost to failed payments / starting MRR |
| Payment failure rate | Failed invoices / total invoices |
| Recovery rate | Recovered invoices / failed invoices |

**The number that matters most:** Involuntary churn as % of total churn. Industry average: 20-40%. Above 30% = recovery gap. Above 50% = fix this first.

---

## Stripe Tax

### Why Set Up Early

Retroactively applying tax creates customer communication headaches and compliance exposure. Start with tax from day one.

```typescript
// Enable Stripe Tax during initial billing setup
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  automatic_tax: { enabled: true },
});
```

---

## Metered/Usage-Based Billing

### New Meters API (2026)

```typescript
// 1. Create a meter
const meter = await stripe.billing.meters.create({
  event_name: 'api_requests',
  default_aggregation: {
    formula: 'sum',
  },
  billing_meter_definition: {
    type: 'aggregated_usage',
    slug: 'api-requests',
  },
});

// 2. Report usage events
await stripe.billing.meterEvents.create({
  event_name: 'api_requests',
  payload: {
    stripe_customer_id: customer.stripe_customer_id,
    value: '100',  // number of API requests
  },
});

// 3. Create metered subscription
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{
    price: meteredPriceId,  // price with meter linkage
  }],
});
```

---

## Implementation Checklist

- [ ] Products and Prices structured correctly (one Product per tier)
- [ ] Pricing model appropriate for stage (flat-rate for early, per-seat/usage for scale)
- [ ] Customer Portal enabled and linked from app
- [ ] Webhook endpoint configured with signature verification
- [ ] Idempotent webhook handlers (event ID deduplication)
- [ ] Smart Retries enabled in Billing settings
- [ ] Dunning email sequence (4-5 emails over 14-21 days)
- [ ] Card update page (branded, tokenized, linked from emails)
- [ ] Subscription lifecycle states mapped to application access
- [ ] Grace period set to 14-21 days for `past_due`
- [ ] Stripe Tax enabled (or tax strategy documented)
- [ ] Metadata on Customers and Subscriptions
- [ ] MRR, churn, and recovery rate tracking in place
- [ ] Recovery workflow fully automated
- [ ] Test mode validation with Stripe test cards

---

## Testing

### Stripe Test Card Numbers

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined (generic) |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0341` | 3D Secure required |
| `4000 0000 0000 0069` | Expired card |
| `4000 0000 0000 0127` | Incorrect CVC |
