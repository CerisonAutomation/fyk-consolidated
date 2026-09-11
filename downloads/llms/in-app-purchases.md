# In-App Purchases: Web App Implementation Patterns

> Sources: Apple Developer Documentation, Google Play Billing Documentation, Stripe Digital Goods Patterns, Web Monetization Community Group

---

## Overview

In-app purchases (IAP) for web apps differ fundamentally from native mobile apps. Web apps cannot use Apple/Google IAP systems directly, so alternative approaches are required for digital goods and consumable purchases.

---

## Purchasing Models for Web Apps

### Model 1: Stripe Checkout (Recommended for Most Web Apps)

Use Stripe Checkout Sessions for one-time and subscription purchases of digital goods.

```typescript
// One-time purchase of digital goods
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{
    price: priceId,  // Pre-configured Price in Stripe
    quantity: 1,
  }],
  success_url: `${APP_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${APP_URL}/purchase/cancel`,
  payment_intent_data: {
    setup_future_usage: 'off_session',
    metadata: {
      product_type: 'consumable',
      product_id: 'extra_credits_100',
      user_id: userId,
    },
  },
  metadata: {
    order_id: generateOrderId(),
    product_type: 'consumable',
  },
});
```

### Model 2: PaymentIntent for Custom UI

Build a custom payment form using Stripe.js and PaymentIntents.

```typescript
// Server: Create PaymentIntent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 299,  // $2.99 in cents
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  metadata: {
    product_id: 'extra_credits_100',
    user_id: userId,
    order_id: generateOrderId(),
  },
});

// Client: Confirm payment
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: customerName },
  },
});
```

### Model 3: Web Monetization (Brave/Coil)

For content-based apps, use the Web Monetization API for micropayments.

```html
<meta name="monetization" content="$wallet.example.com/alice">
```

```javascript
if (document.monetization) {
  document.monetization.addEventListener('monetizationstart', () => {
    // Unlock premium content
  });
}
```

---

## Consumable Digital Goods Patterns

### Credit/Token System

```typescript
// Database schema
type UserCredits = {
  id: string;
  user_id: string;
  balance: number;
  total_purchased: number;
  total_consumed: number;
  updated_at: Date;
};

type CreditTransaction = {
  id: string;
  user_id: string;
  type: 'purchase' | 'consumption' | 'refund' | 'bonus';
  amount: number;
  stripe_payment_id?: string;
  description: string;
  created_at: Date;
};
```

### Purchase and Consumption Flow

```typescript
// 1. User initiates purchase
async function initiatePurchase(userId: string, productId: string) {
  const product = await getProduct(productId);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: product.stripe_price_id, quantity: 1 }],
    success_url: `${APP_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/purchase/cancel`,
    metadata: {
      user_id: userId,
      product_id: productId,
      credits_amount: product.credits.toString(),
    },
  });
  return { checkoutUrl: session.url };
}

// 2. On successful payment (webhook)
async function handlePurchaseComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata.user_id;
  const creditsAmount = parseInt(session.metadata.credits_amount);

  // Atomic credit addition
  await db.$transaction([
    db.userCredits.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        balance: creditsAmount,
        total_purchased: creditsAmount,
      },
      update: {
        balance: { increment: creditsAmount },
        total_purchased: { increment: creditsAmount },
      },
    }),
    db.creditTransaction.create({
      data: {
        user_id: userId,
        type: 'purchase',
        amount: creditsAmount,
        stripe_payment_id: session.payment_intent as string,
        description: `Purchased ${creditsAmount} credits`,
      },
    }),
  ]);
}

// 3. Consume credits (atomic decrement)
async function consumeCredits(userId: string, amount: number, description: string) {
  const result = await db.$transaction(async (tx) => {
    const credits = await tx.userCredits.findUnique({
      where: { user_id: userId },
    });

    if (!credits || credits.balance < amount) {
      throw new InsufficientCreditsError('Not enough credits');
    }

    await tx.userCredits.update({
      where: { user_id: userId },
      data: {
        balance: { decrement: amount },
        total_consumed: { increment: amount },
      },
    });

    await tx.creditTransaction.create({
      data: {
        user_id: userId,
        type: 'consumption',
        amount: -amount,
        description,
      },
    });

    return credits.balance - amount;
  });

  return result;
}
```

---

## Refund Handling

```typescript
async function handleRefund(stripeEvent: Stripe.Event) {
  const charge = stripeEvent.data.object as Stripe.Charge;
  const paymentIntentId = charge.payment_intent as string;

  // Find original transaction
  const transaction = await db.creditTransaction.findFirst({
    where: { stripe_payment_id: paymentIntentId, type: 'purchase' },
  });

  if (!transaction) return;

  // Reverse credits
  await db.$transaction([
    db.userCredits.update({
      where: { user_id: transaction.user_id },
      data: {
        balance: { decrement: transaction.amount },
        total_purchased: { decrement: transaction.amount },
      },
    }),
    db.creditTransaction.create({
      data: {
        user_id: transaction.user_id,
        type: 'refund',
        amount: -transaction.amount,
        stripe_payment_id: paymentIntentId,
        description: `Refund for ${transaction.amount} credits`,
      },
    }),
  ]);
}
```

---

## Webhook Events for Digital Goods

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Grant digital goods to user |
| `payment_intent.succeeded` | Confirm purchase, add credits/items |
| `payment_intent.payment_failed` | Show error, allow retry |
| `charge.refunded` | Reverse digital goods |
| `charge.dispute.created` | Flag account for review |

---

## Anti-Fraud Patterns

### Velocity Checks

```typescript
async function checkPurchaseVelocity(userId: string): Promise<boolean> {
  const recentPurchases = await db.creditTransaction.count({
    where: {
      user_id: userId,
      type: 'purchase',
      created_at: { gte: new Date(Date.now() - 3600000) }, // Last hour
    },
  });

  return recentPurchases < 5; // Max 5 purchases per hour
}
```

### Stripe Radar Rules

Configure in Stripe Dashboard:
- Block payments from high-risk countries
- Require 3DS for transactions above threshold
- Flag repeated failed attempts

### Metadata for Fraud Detection

```typescript
await stripe.paymentIntents.create({
  amount: amount,
  currency: 'usd',
  metadata: {
    user_id: userId,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    session_id: sessionId,
    purchase_type: 'consumable',
  },
});
```

---

## Pricing Architecture for Digital Goods

### Price Configuration in Stripe

```
Product: "AI Credits"
  +-- Price: $4.99 (100 credits)
  +-- Price: $9.99 (250 credits)  -- best value badge
  +-- Price: $19.99 (600 credits) -- most popular badge
  +-- Price: $49.99 (2000 credits)
```

### Display Strategy

```typescript
const creditPacks = [
  { id: 'pack_100', credits: 100, price: 499, badge: null },
  { id: 'pack_250', credits: 250, price: 999, badge: 'Best Value' },
  { id: 'pack_600', credits: 600, price: 1999, badge: 'Most Popular' },
  { id: 'pack_2000', credits: 2000, price: 4999, badge: null },
];

// Calculate per-credit cost for comparison
creditPacks.map(pack => ({
  ...pack,
  perCreditCost: pack.price / pack.credits,  // e.g., 4.99 cents each
}));
```

---

## Mobile Web Considerations

### Apple App Store Compliance

If your web app is served within an iOS WebView or WKWebView:
- Apple requires IAP for digital goods (30% commission)
- Physical goods and services are exempt
- Reading apps (like Netflix) may use their own payment

### Safari/WebKit Limitations

```typescript
// Detect iOS Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isIOS && isSafari) {
  // Apple may block Stripe Checkout popups
  // Use redirect-based checkout instead
  window.location.href = session.url;
}
```

---

## Receipt Validation (Web Apps)

For web-based digital goods, you serve as the receipt authority:

```typescript
// After purchase confirmation via webhook
async function generateReceipt(userId: string, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);

  return {
    receipt_id: `RCP-${Date.now()}`,
    user_id: userId,
    stripe_session_id: sessionId,
    items: lineItems.data.map(item => ({
      description: item.description,
      amount: item.amount_total,
      quantity: item.quantity,
    })),
    total: session.amount_total,
    currency: session.currency,
    created_at: new Date().toISOString(),
    // Store for customer self-service
  };
}
```

---

## Subscription + Consumable Hybrid

Many apps combine subscriptions with consumable add-ons:

```typescript
// User has a base subscription (monthly credits)
// Can purchase additional credits as consumables

async function getUserAvailableCredits(userId: string) {
  const subscription = await db.subscriptions.findFirst({
    where: { user_id: userId, status: 'active' },
  });

  const purchasedCredits = await db.userCredits.findUnique({
    where: { user_id: userId },
  });

  const monthlyAllowance = subscription?.monthly_credits || 0;
  const purchased = purchasedCredits?.balance || 0;

  return {
    monthly: monthlyAllowance,
    purchased,
    total: monthlyAllowance + purchased,
  };
}
```

---

## Implementation Checklist

- [ ] Choose purchasing model (Checkout, PaymentIntent, or hybrid)
- [ ] Set up credit/token system with atomic transactions
- [ ] Implement webhook handlers with idempotency
- [ ] Configure refund handling for digital goods
- [ ] Add velocity checks and fraud prevention
- [ ] Design pricing display with per-unit cost comparison
- [ ] Handle mobile web edge cases (Safari, iOS)
- [ ] Set up receipt generation and storage
- [ ] Test with Stripe test cards and edge cases
- [ ] Plan for subscription + consumable hybrid if needed
