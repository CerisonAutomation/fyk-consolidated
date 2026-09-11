# SaaS Pricing Tier Strategies: Implementation Patterns

> Sources: Price Intelligently/Paddle Pricing Research, OpenView SaaS Benchmarks, Stripe Billing Best Practices, Patrick Campbell Pricing Framework

---

## Pricing Model Selection

### Models by Business Type

| Model | Best For | Example |
|-------|----------|---------|
| Flat-Rate | Early-stage SaaS, simple products | $29/mo, $99/mo, $299/mo |
| Per-Seat | Collaboration tools, team products | $10/user/mo |
| Usage-Based | APIs, infrastructure, data products | $0.001 per API call |
| Tiered | Feature-differentiated products | Starter/Pro/Enterprise |
| Hybrid | Complex products | Base + usage overage |
| Free + Paid | Network effects, freemium | Free tier + paid upgrades |

### Model by Stage

```
Pre-PMF (0-$10K MRR):
  -> Flat-rate with 2-3 tiers
  -> Simple to understand, sell, and support
  -> Avoid over-engineering

Growth ($10K-$100K MRR):
  -> Consider per-seat or usage-based for expansion
  -> Annual plans with 15-20% discount
  -> Introduce enterprise tier

Scale ($100K+ MRR):
  -> Hybrid models (base + usage)
  -> Custom enterprise pricing
  -> Multi-currency support
```

---

## Tier Architecture

### The Good-Better-Best Framework

```
Starter ($29/mo)          Pro ($99/mo)           Enterprise ($299/mo)
├── Core features         ├── Everything in Starter ├── Everything in Pro
├── 1 user                ├── 10 users             ├── Unlimited users
├── 1GB storage           ├── 100GB storage        ├── 1TB storage
├── Email support         ├── Priority support     ├── Dedicated support
├── Basic analytics       ├── Advanced analytics   ├── Custom analytics
└── API access (1K calls) ├── API access (100K)    ├── API access (unlimited)
                          ├── Custom branding       ├── SSO/SAML
                          └── Integrations          ├── SLA guarantee
                                                    └── Custom contracts
```

### Anchor Pricing Psychology

- **Starter** = Makes Pro look affordable (decoy effect)
- **Pro** = Target tier (highest margin, most customers)
- **Enterprise** = Aspirational, signals quality, captures high-value customers

### Price Point Guidelines

| Tier | Price Range | Purpose |
|------|-------------|---------|
| Starter | $9-49/mo | Low barrier to entry, trial alternative |
| Pro | $49-199/mo | Primary revenue driver, highest margin |
| Enterprise | $299-999+/mo | High-value customers, custom needs |

---

## Pricing Page Design Patterns

### Feature Comparison Table

```html
<!-- Simplified structure -->
<table>
  <thead>
    <tr>
      <th></th>
      <th>Starter</th>
      <th class="recommended">Pro ⭐</th>
      <th>Enterprise</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Users</td>
      <td>1</td>
      <td class="recommended">10</td>
      <td>Unlimited</td>
    </tr>
    <!-- ... more features ... -->
    <tr>
      <td></td>
      <td><a href="/signup?plan=starter">Get Started</a></td>
      <td class="recommended"><a href="/signup?plan=pro">Start Free Trial</a></td>
      <td><a href="/contact-sales">Contact Sales</a></td>
    </tr>
  </tbody>
</table>
```

### Pricing Display Strategy

```typescript
const pricingTiers = [
  {
    name: 'Starter',
    monthly: 2900,      // cents
    annual: 29000,      // cents (2 months free = ~17% discount)
    annualMonthly: 2417, // per month when billed annually
    badge: null,
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    monthly: 9900,
    annual: 99000,
    annualMonthly: 8250,
    badge: 'Most Popular',
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    monthly: null,      // Custom pricing
    annual: null,
    badge: null,
    cta: 'Contact Sales',
    highlighted: false,
    customPricing: true,
  },
];
```

### Annual vs. Monthly Toggle

```typescript
function calculateAnnualDiscount(monthlyPrice: number, annualPrice: number) {
  const monthlyCost = monthlyPrice * 12;
  const savings = monthlyCost - annualPrice;
  const percentSaved = Math.round((savings / monthlyCost) * 100);
  const monthsFree = Math.round(savings / monthlyPrice);

  return {
    monthlyCost,
    annualCost: annualPrice,
    savings,
    percentSaved,     // e.g., 17%
    monthsFree,       // e.g., 2 months free
    displayText: `${percentSaved}% off`, // or "2 months free"
  };
}
```

---

## Free Trial Strategy

### Trial Types

| Type | Duration | Best For | Conversion |
|------|----------|----------|-----------|
| No trial (free tier) | Permanent | Products with clear immediate value | Lower initial, higher LTV |
| Short trial | 7 days | Products with fast time-to-value | Higher urgency |
| Standard trial | 14 days | Most SaaS products | Industry standard |
| Long trial | 30 days | Complex products, enterprise | Lower urgency, higher activation |
| Reverse trial | 14 days | Products with obvious premium value | Highest conversion |

### Trial Configuration

```typescript
const trialConfig = {
  // Collect payment method at trial start?
  collectPaymentMethod: true,  // SIGNIFICANTLY improves conversion

  // Trial length by tier
  trialDays: {
    starter: 14,
    pro: 14,
    enterprise: 30,  // Or "contact sales"
  },

  // What happens at trial end?
  trialEndBehavior: 'charge_automatically',  // vs 'require_payment_method'

  // Trial reminders
  reminders: [
    { daysBeforeEnd: 3, type: 'in_app' },
    { daysBeforeEnd: 1, type: 'email' },
    { daysBeforeEnd: 0, type: 'email' },  // Trial ending today
  ],
};
```

---

## Upgrade/Downgrade Flows

### Upgrade Flow

```typescript
// Immediate upgrade with proration
async function upgradePlan(userId: string, newPriceId: string) {
  const subscription = await getUserSubscription(userId);

  // Upgrade immediately, charge prorated difference
  const updated = await stripe.subscriptions.update(
    subscription.stripe_subscription_id,
    {
      items: [{
        id: subscription.stripe_item_id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
      billing_cycle_anchor: 'now',
    }
  );

  // Update local database immediately
  await db.subscriptions.update({
    where: { id: subscription.id },
    data: {
      plan_id: getPlanFromPriceId(newPriceId),
      status: 'active',
      stripe_subscription_id: updated.id,
    },
  });

  // Grant access to new features immediately
  await grantFeatureAccess(userId, newPriceId);

  return { success: true, prorationAmount: updated.latest_invoice };
}
```

### Downgrade Flow

```typescript
// Schedule downgrade for end of period
async function downgradePlan(userId: string, newPriceId: string) {
  const subscription = await getUserSubscription(userId);

  // Schedule change for end of billing period
  const updated = await stripe.subscriptions.update(
    subscription.stripe_subscription_id,
    {
      items: [{
        id: subscription.stripe_item_id,
        price: newPriceId,
      }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
    }
  );

  // Update local record with pending change
  await db.subscriptions.update({
    where: { id: subscription.id },
    data: {
      pending_plan_id: getPlanFromPriceId(newPriceId),
      pending_change_date: new Date(subscription.current_period_end),
    },
  });

  return {
    success: true,
    effectiveDate: subscription.current_period_end,
    message: 'Your plan will change at the end of your billing period.',
  };
}
```

---

## Enterprise Pricing

### Custom Pricing Configuration

```typescript
// Enterprise tier configuration
const enterpriseConfig = {
  hasCustomPricing: true,
  basePrice: null,  // Negotiated per customer
  minimumCommitment: 10000,  // $10,000/year minimum

  // Common enterprise add-ons
  addOns: [
    { id: 'sso', name: 'SSO/SAML', price: 5000 },
    { id: 'sla', name: '99.99% SLA', price: 10000 },
    { id: 'dedicated_support', name: 'Dedicated CSM', price: 15000 },
    { id: 'custom_integrations', name: 'Custom Integrations', price: 'quote' },
    { id: 'on_premise', name: 'On-Premise Deployment', price: 'quote' },
  ],

  // Contract terms
  billingTerms: ['annual', 'multi-year'],
  paymentTerms: ['net30', 'net60', 'wire'],
  discountTiers: [
    { commitment: 50000, discount: 0.10 },   // 10% off $50K+
    { commitment: 100000, discount: 0.15 },  // 15% off $100K+
    { commitment: 250000, discount: 0.20 },  // 20% off $250K+
  ],
};
```

### Quote Configuration

```typescript
// Create Stripe Quote for enterprise deals
async function createEnterpriseQuote(accountId: string, config: QuoteConfig) {
  const quote = await stripe.quotes.create({
    customer: config.stripeCustomerId,
    line_items: config.lineItems.map(item => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    discounts: config.discounts?.map(d => ({
      coupon: d.couponId,
    })),
    // Net payment terms
    collection_method: 'send_invoice',
    days_until_due: 30,
    // Custom expiration
    expires_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    metadata: {
      account_id: accountId,
      sales_rep: config.salesRep,
      deal_size: config.estimatedARR.toString(),
    },
  });

  return quote;
}
```

---

## Coupon and Discount Strategy

### Discount Types

| Type | Use Case | Implementation |
|------|----------|---------------|
| Percentage off | Promotions, annual billing | `10% off first 3 months` |
| Fixed amount | Loyalty rewards | `$50 off your next invoice` |
| Free trial extension | Win-back campaigns | `Extra 14 days free` |
| Upgrade coupon | Upsell campaigns | `Upgrade to Pro for $1 less` |

### Stripe Coupon Implementation

```typescript
// Create a coupon for annual billing
const annualCoupon = await stripe.coupons.create({
  name: 'Annual Plan Discount',
  duration: 'forever',
  percent_off: 17,  // 2 months free
});

// Apply coupon to subscription
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: monthlyPriceId }],
  coupon: annualCoupon.id,
});

// Or use a promotion code for marketing
const promoCode = await stripe.promotionCodes.create({
  coupon: annualCoupon.id,
  code: 'ANNUAL2026',
  max_redemptions: 1000,
  expires_at: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
});
```

---

## Multi-Currency Pricing

### Currency Configuration

```typescript
const currencyConfig = {
  USD: { monthly: 2900, annual: 29000 },
  EUR: { monthly: 2700, annual: 27000 },
  GBP: { monthly: 2400, annual: 24000 },
  JPY: { monthly: 4500, annual: 45000 },
};

// Detect user's currency from location or preference
async function getPricingForUser(userId: string) {
  const user = await db.users.findUnique({ where: { id: userId } });
  const currency = user.preferred_currency || detectCurrencyFromIP(req.ip);

  return currencyConfig[currency] || currencyConfig.USD;
}

// Stripe handles currency conversion automatically
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  currency: userCurrency,
  line_items: [{ price: priceId, quantity: 1 }],
  // ...
});
```

---

## Pricing Experiments

### A/B Test Framework

```typescript
const pricingExperiments = [
  {
    id: 'price_point_test',
    variants: [
      { name: 'control', proPrice: 9900 },     // $99/mo
      { name: 'variant_a', proPrice: 7900 },   // $79/mo
      { name: 'variant_b', proPrice: 12900 },  // $129/mo
    ],
    metric: 'revenue_per_visitor',
    minimumSample: 2000,
    duration: '30 days',
  },
  {
    id: 'trial_length_test',
    variants: [
      { name: 'control', trialDays: 14 },
      { name: 'variant_a', trialDays: 7 },
      { name: 'variant_b', trialDays: 30 },
    ],
    metric: 'trial_to_paid_conversion',
    minimumSample: 1000,
    duration: '60 days',
  },
];

// Assign user to variant
function getExperimentVariant(userId: string, experimentId: string): string {
  // Deterministic assignment based on user ID hash
  const hash = hashCode(userId + experimentId);
  const variantIndex = Math.abs(hash) % totalVariants;
  return variants[variantIndex].name;
}
```

---

## Win-Back Pricing

### Cancellation Flow with Retention Offers

```typescript
async function handleCancellation(userId: string, reason: string) {
  const subscription = await getUserSubscription(userId);
  const lifetimeValue = await calculateLTV(userId);

  // Determine retention offer based on value
  let retentionOffer = null;

  if (lifetimeValue > 1000) {
    // High-value customer
    retentionOffer = {
      type: 'discount',
      percentOff: 50,
      duration: '3_months',
      message: 'We value you! Here\'s 50% off for the next 3 months.',
    };
  } else if (reason === 'too_expensive') {
    // Price-sensitive customer
    retentionOffer = {
      type: 'downgrade',
      suggestedPlan: 'starter',
      message: 'Would you like to switch to our Starter plan instead?',
    };
  } else if (reason === 'not_using') {
    // Low engagement customer
    retentionOffer = {
      type: 'pause',
      maxPauseDays: 60,
      message: 'Need a break? Pause your subscription for up to 60 days.',
    };
  }

  return {
    cancelationFlow: 'retention',
    offer: retentionOffer,
    requiresFeedback: true,
  };
}
```

### Pause Subscription

```typescript
// Stripe supports subscription pausing
const subscription = await stripe.subscriptions.update(
  subscriptionId,
  {
    pause_collection: {
      behavior: 'void',  // or 'keep_as_draft'
      resumes_at: resumeDate,  // Optional: auto-resume
    },
  }
);
```

---

## Implementation Checklist

- [ ] Pricing model selected (flat-rate, per-seat, usage-based, hybrid)
- [ ] 2-3 tiers configured with clear value differentiation
- [ ] Annual vs. monthly pricing with appropriate discount
- [ ] Free trial configured with payment method collection
- [ ] Upgrade flow with immediate proration
- [ ] Downgrade flow scheduled for end of period
- [ ] Enterprise tier with custom pricing/quoting
- [ ] Multi-currency support configured
- [ ] Coupons and promotion codes set up
- [ ] Cancellation flow with retention offers
- [ ] Subscription pause functionality
- [ ] Pricing page A/B tests running
- [ ] Win-back email sequences configured
- [ ] Pricing review scheduled quarterly
