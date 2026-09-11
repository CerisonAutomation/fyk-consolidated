# Revenue Optimization: Subscription Metrics and Recovery Patterns

> Sources: Stripe Revenue Recovery Documentation, RetryHero Analytics, ProfitWell/Paddle Churn Benchmarks, SaaS Capital Metrics Database

---

## Core Revenue Metrics

### Monthly Recurring Revenue (MRR)

```
MRR = sum(active_subscriptions monthly_revenue)

MRR Components:
  New MRR         = MRR from new customers
  Expansion MRR   = MRR from upgrades, add-ons, seat increases
  Contraction MRR = MRR lost from downgrades
  Churn MRR       = MRR lost from cancellations
  Reactivation MRR = MRR from previously churned customers returning

Net New MRR = New + Expansion + Reactivation - Contraction - Churn
```

### Key Performance Indicators

| Metric | Formula | Benchmark |
|--------|---------|-----------|
| Gross Revenue Retention (GRR) | (MRR - Churn - Contraction) / Starting MRR | >90% is excellent |
| Net Revenue Retention (NRR) | (MRR - Churn - Contraction + Expansion) / Starting MRR | >120% is excellent |
| Monthly Churn Rate | Churned MRR / Starting MRR | <5% monthly |
| Annual Churn Rate | 1 - (1 - Monthly)^12 | <50% annually |
| Customer Lifetime Value (LTV) | ARPA / Monthly Churn Rate | >3x CAC |
| Customer Acquisition Cost (CAC) | Total Sales & Marketing / New Customers | < LTV/3 |
| LTV:CAC Ratio | LTV / CAC | >3:1 |
| Payback Period (months) | CAC / ARPA | <12 months |

---

## Churn Analysis Framework

### Types of Churn

```
Total Churn = Voluntary Churn + Involuntary Churn

Voluntary Churn:   Customer deliberately cancels
  - Dissatisfaction
  - Budget cuts
  - Switching to competitor
  - No longer needs product

Involuntary Churn: Payment fails and isn't recovered
  - Expired card
  - Insufficient funds
  - Bank decline
  - Fraud block
```

### Churn Rate Benchmarks by Stage

| MRR Range | Good Monthly Churn | Average | Concerning |
|-----------|-------------------|---------|------------|
| $0-10K | <8% | 8-12% | >12% |
| $10K-50K | <5% | 5-8% | >8% |
| $50K-100K | <3% | 3-5% | >5% |
| $100K+ | <2% | 2-3% | >3% |

### Involuntary Churn Impact

Industry average: 20-40% of all churn is involuntary.

```
If MRR = $50,000
If total monthly churn = 5% ($2,500)
If involuntary portion = 30% ($750/month)
Annual involuntary loss = $9,000

Recovery stack at 60% effectiveness = $5,400 saved/year
```

---

## Payment Recovery Stack

### Three-Layer Recovery System

#### Layer 1: Smart Retries (ML-Powered)

- Stripe retries failed payments at optimal times
- Recovers ~15% of failed payments (soft declines only)
- Free and automatic -- always enable
- Handles: insufficient funds, temporary processor errors

#### Layer 2: Dunning Email Sequence

- Recovers additional ~25% (cumulative ~40%)
- Customized emails with plan details and direct links
- 4-5 emails over 14-21 days

#### Layer 3: Card Update Pages

- Recovers additional ~20% (cumulative ~60%)
- Dedicated, branded pages for updating payment methods
- Personalized with plan details and deadline
- Highest conversion: 20-25% vs. 2-5% for generic emails

### Dunning Email Template Framework

```
Email 1 (Day 0): Friendly heads-up
  Subject: "Your payment needs attention"
  Content: Soft reminder, direct link to update card
  Tone: Helpful, not alarming

Email 2 (Day 3): Helpful reminder
  Subject: "Quick reminder: update your payment method"
  Content: Step-by-step instructions, support link
  Tone: Supportive

Email 3 (Day 7): Urgency
  Subject: "Action needed: your account will be affected"
  Content: Clear timeline of consequences
  Tone: Firm but fair

Email 4 (Day 12): Last chance
  Subject: "Final notice: update payment by [date]"
  Content: Specific deadline, what happens after
  Tone: Direct

Email 5 (Day 14-21): Final notice
  Subject: "Last day to save your subscription"
  Content: Final deadline, data export options
  Tone: Final, with alternative options
```

---

## Expansion Revenue Strategies

### Usage-Based Expansion

```typescript
// Monitor usage approaching plan limits
async function checkUsageAlerts(userId: string) {
  const usage = await getUserUsage(userId);
  const plan = await getUserPlan(userId);

  const usagePercentage = usage.current / plan.limit;

  if (usagePercentage >= 0.8 && !usage.alertSent) {
    // Approaching limit -- suggest upgrade
    await sendUpgradeReminder(userId, {
      currentUsage: usage.current,
      limit: plan.limit,
      suggestedPlan: plan.upgradeTarget,
    });
    await markAlertSent(usage.id);
  }
}
```

### Seat-Based Expansion

```typescript
// Detect team growth
async function detectSeatExpansion(accountId: string) {
  const account = await getAccount(accountId);
  const activeUsers = await countActiveUsers(accountId);

  if (activeUsers > account.current_seats * 0.9) {
    // 90%+ seats used
    await notifyAccountManager(account, {
      type: 'seat_expansion_suggested',
      currentSeats: account.current_seats,
      activeUsers,
    });
  }
}
```

### Feature Gating for Upsell

```typescript
function checkFeatureAccess(user: User, feature: string): FeatureAccessResult {
  const planFeatures = getPlanFeatures(user.plan);

  if (planFeatures.includes(feature)) {
    return { allowed: true };
  }

  // Feature not in current plan -- show upgrade prompt
  const upgradePlan = findPlanWithFeature(feature);
  return {
    allowed: false,
    upgradeRequired: true,
    suggestedPlan: upgradePlan,
    previewUrl: `/preview/${feature}`,
  };
}
```

---

## Revenue Forecasting

### MRR Projection Model

```typescript
function projectMRR(
  currentMRR: number,
  monthlyGrowthRate: number,
  monthlyChurnRate: number,
  months: number
): MRRProjection[] {
  let mrr = currentMRR;
  const projections = [];

  for (let i = 1; i <= months; i++) {
    const expansionMRR = mrr * 0.02; // 2% monthly expansion
    const churnedMRR = mrr * monthlyChurnRate;
    const newMRR = (mrr + expansionMRR) * monthlyGrowthRate;

    mrr = mrr + newMRR + expansionMRR - churnedMRR;

    projections.push({
      month: i,
      mrr: Math.round(mrr),
      churned: Math.round(churnedMRR),
      expansion: Math.round(expansionMRR),
      netNew: Math.round(newMRR),
    });
  }

  return projections;
}
```

### Cohort Analysis

```typescript
// Group customers by signup month
async function analyzeCohort(cohortMonth: string) {
  const customers = await db.subscriptions.findMany({
    where: {
      created_at: {
        gte: new Date(`${cohortMonth}-01`),
        lt: new Date(`${cohortMonth}-32`),
      },
    },
  });

  // Track retention over time
  const retention = [];
  for (let month = 0; month < 12; month++) {
    const stillActive = customers.filter(c => {
      const periodEnd = new Date(c.current_period_end);
      const checkDate = new Date();
      checkDate.setMonth(checkDate.getMonth() + month);
      return periodEnd >= checkDate;
    });

    retention.push({
      month,
      active: stillActive.length,
      retentionRate: stillActive.length / customers.length,
    });
  }

  return retention;
}
```

---

## Revenue Recovery Automation

### Self-Service Recovery Flow

```typescript
// When user hits a "payment failed" page
async function handlePaymentFailedPage(userId: string) {
  const failedInvoice = await getLatestFailedInvoice(userId);

  return {
    showBanner: true,
    message: 'Your payment failed. Update your payment method to avoid service interruption.',
    actions: [
      {
        label: 'Update Payment Method',
        url: `/billing/payment-method?invoice=${failedInvoice.id}`,
      },
      {
        label: 'View Invoice',
        url: `/billing/invoices/${failedInvoice.id}`,
      },
    ],
    // Grace period info
    gracePeriod: {
      daysRemaining: calculateGracePeriodRemaining(failedInvoice),
      downgradeDate: calculateDowngradeDate(failedInvoice),
    },
  };
}
```

### Proactive Payment Method Updates

```typescript
// Remind users before card expires
async function checkExpiringCards() {
  const expiringCards = await db.paymentMethods.findMany({
    where: {
      exp_month: new Date().getMonth() + 1,
      exp_year: new Date().getFullYear(),
    },
  });

  for (const card of expiringCards) {
    await sendExpirationReminder(card.user_id, {
      last4: card.last4,
      brand: card.brand,
      expiryDate: `${card.exp_month}/${card.exp_year}`,
      updateUrl: '/billing/payment-method',
    });
  }
}
```

---

## A/B Testing Revenue Strategies

### Pricing Page Tests

```typescript
const experiments = [
  {
    name: 'annual_discount_display',
    variants: ['percentage', 'dollar_amount', 'monthly_equivalent'],
    metric: 'conversion_rate',
    minimumSample: 1000,
  },
  {
    name: 'trial_length',
    variants: ['7_days', '14_days', '30_days'],
    metric: 'trial_to_paid_conversion',
    minimumSample: 500,
  },
  {
    name: 'checkout_flow',
    variants: ['stripe_checkout', 'inline_form'],
    metric: 'payment_completion_rate',
    minimumSample: 500,
  },
];
```

---

## Revenue Dashboard Metrics

### Essential Metrics to Track

| Category | Metric | Frequency |
|----------|--------|-----------|
| Growth | New MRR | Daily |
| Growth | Net New MRR | Daily |
| Growth | MRR | Daily |
| Retention | Gross Churn Rate | Weekly |
| Retention | Net Revenue Retention | Monthly |
| Retention | Logo Retention Rate | Monthly |
| Recovery | Payment Failure Rate | Daily |
| Recovery | Recovery Rate | Weekly |
| Recovery | Involuntary Churn Rate | Monthly |
| Expansion | Expansion MRR | Weekly |
| Expansion | Average Revenue Per Account | Monthly |
| Health | LTV:CAC Ratio | Monthly |
| Health | Payback Period | Monthly |

---

## Implementation Checklist

- [ ] MRR, churn, and recovery rate tracking in place
- [ ] Involuntary churn percentage calculated
- [ ] Smart Retries enabled in Stripe
- [ ] Dunning email sequence (4-5 emails) configured
- [ ] Card update pages branded and linked from emails
- [ ] Proactive card expiration reminders set up
- [ ] Usage-based expansion alerts configured
- [ ] Seat-based expansion detection in place
- [ ] Feature gating tied to subscription plan
- [ ] Cohort analysis running monthly
- [ ] Revenue forecast model updated quarterly
- [ ] A/B tests running on pricing/checkout
- [ ] Revenue dashboard with key metrics visible
