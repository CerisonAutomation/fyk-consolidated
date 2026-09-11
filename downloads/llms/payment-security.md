# Payment Security: PCI Compliance and Implementation Patterns

> Sources: Stripe Integration Security Guide, PCI Security Standards Council, OWASP, Stripe Best Practices for Secret API Keys

---

## PCI DSS Overview

The Payment Card Industry Data Security Standard (PCI DSS) is the global security standard for all entities that store, process, or transmit cardholder or sensitive authentication data. Anyone involved with processing, transmission, or storage of card data must comply.

### Compliance Levels

| Level | Criteria | Requirements |
|-------|----------|-------------|
| Level 1 | >6M transactions/year | Annual on-site audit by QSA, quarterly ASV scans |
| Level 1 | Data breach involved | Same as above |
| Level 2 | 1-6M transactions/year | Annual SAQ, quarterly ASV scans |
| Level 3 | 20K-1M transactions/year | Annual SAQ |
| Level 4 | <20K transactions/year | Annual SAQ recommended |

### Shared Responsibility with Stripe

- **Stripe:** Certified annually as PCI Level 1 Service Provider
- **Your business:** Must accept payments in a PCI-compliant manner and attest annually

---

## Low-Risk Integration Strategy

### Key Principle: Keep Card Data Off Your Servers

Use Stripe Checkout, Stripe Elements, or Stripe.js to collect card data directly from Stripe. Card numbers never touch your server, dramatically reducing PCI scope.

**Without tokenization (HIGH risk):**
```
Customer -> Your Server (sees card data) -> Stripe
300+ PCI controls required
```

**With tokenization (LOW risk):**
```
Customer -> Stripe.js (tokenizes) -> Stripe
Your server never sees card data
PCI SAQ-A (minimal requirements)
```

### Out-of-Scope Data You CAN Store

```typescript
// Safe to store (not PCI-sensitive)
{
  card_brand: 'visa',           // Card type
  card_last4: '4242',           // Last 4 digits
  card_exp_month: 12,           // Expiration month
  card_exp_year: 2027,          // Expiration year
  fingerprint: 'abc123...',     // Stripe's unique card fingerprint
}
```

### Data You Must NEVER Store

- Full card number (PAN)
- CVV/CVC code
- Full track data
- PIN data
- Full magnetic stripe data

---

## TLS/HTTPS Requirements

### Minimum Requirements

- **TLS 1.2 or above** for all payment pages
- All resources (JS, CSS, images) served over TLS
- No mixed content warnings

### Setup Checklist

1. Obtain certificate from reputable CA (Let's Encrypt, DigiCert, NameCheap)
2. Configure server to use certificate
3. Test with Qualys SSL Labs (grade A or A+)
4. Redirect all HTTP to HTTPS

### Content Security Policy for Stripe

```
connect-src: https://checkout.stripe.com
frame-src: https://checkout.stripe.com
script-src: https://checkout.stripe.com
img-src: https://*.stripe.com
```

---

## API Key Security

### Secret Key Management

```typescript
// NEVER do this
const stripe = Stripe('sk_live_real_key_here');  // In client code!

// ALWAYS do this
// Server-side only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use environment variables
// .env (never commit)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Key Rotation Strategy

```bash
# 1. Generate new key in Stripe Dashboard
# 2. Update environment variables
# 3. Deploy with new key
# 4. Verify all endpoints work
# 5. Revoke old key in Stripe Dashboard
```

### API Key Permissions

| Key Type | Where to Use | Access Level |
|----------|-------------|--------------|
| Publishable key | Client-side (browser) | Create tokens, display payment forms |
| Secret key | Server-side only | Full API access |
| Restricted keys | Specific integrations | Limited to specific resources |

---

## Webhook Security

### Signature Verification (Required)

```typescript
import stripe from 'stripe';

// Always verify webhook signatures
const sig = req.headers['stripe-signature'];
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const event = stripe.webhooks.constructEvent(
    req.body,           // Raw body
    sig,
    endpointSecret
  );
} catch (err) {
  // Invalid signature -- reject
  res.status(400).send('Webhook Error');
  return;
}
```

### Webhook Endpoint Hardening

```typescript
// 1. Use raw body (not parsed JSON)
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => { /* ... */ }
);

// 2. IP allowlisting (optional, extra layer)
const STRIPE_IPS = [
  '54.187.174.169',
  '54.187.205.24',
  '54.241.31.39',
  '54.241.31.67',
  '54.241.31.83',
  '54.241.38.145',
  '54.241.42.117',
];

function isStripeIP(ip: string): boolean {
  return STRIPE_IPS.includes(ip);
}

// 3. Reject non-POST methods
// 4. Log all webhook attempts for auditing
// 5. Use idempotency to handle duplicate events
```

---

## Strong Customer Authentication (SCA)

### What is SCA?

SCA (PSD2 regulation in EU) requires two-factor authentication for electronic payments. Stripe handles this automatically with 3D Secure.

### PaymentIntent with Automatic SCA

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1099,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  // SCA is handled automatically
});
```

### Client-Side 3DS Handling

```javascript
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);

if (error) {
  // Authentication failed or was abandoned
  showError(error.message);
} else if (paymentIntent.status === 'succeeded') {
  // Payment succeeded (possibly after 3DS)
  showSuccess();
}
```

### Off-Session Payments and SCA

```typescript
// For subscriptions/recurring payments
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2900,
  currency: 'usd',
  customer: customerId,
  off_session: true,
  confirm: true,
  payment_method: paymentMethodId,
  // If 3DS required, paymentIntent.status = 'requires_action'
  // Handle by emailing customer a payment link
});
```

---

## Input Validation and Sanitization

### Server-Side Validation

```typescript
// Validate payment amounts
function validatePaymentAmount(amount: number, currency: string): void {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (amount > 99999999) throw new Error('Amount exceeds maximum');

  const maxAmount = getMaxAmountForCurrency(currency);
  if (amount > maxAmount) throw new Error('Amount exceeds currency maximum');
}

// Validate currency codes
function isValidCurrency(currency: string): boolean {
  return /^[A-Z]{3}$/.test(currency);
}
```

### Never Trust Client-Side Data

```typescript
// BAD: Trusting client amount
app.post('/create-payment', (req, res) => {
  const amount = req.body.amount; // Client could send anything!
  stripe.paymentIntents.create({ amount }); // DANGER
});

// GOOD: Server determines amount
app.post('/create-payment', async (req, res) => {
  const product = await db.products.findUnique({
    where: { id: req.body.productId },
  });

  const amount = product.price; // Server is source of truth
  stripe.paymentIntents.create({ amount });
});
```

---

## Fraud Prevention

### Stripe Radar Configuration

```typescript
// Use Radar rules in Stripe Dashboard
// Example rules:
// - Block if risk_score > 85
// - Review if risk_score > 65
// - Block if country in [high-risk countries]
// - Require 3DS if amount > $500 and new customer
```

### Application-Level Fraud Checks

```typescript
// Velocity checks
async function checkVelocity(userId: string, action: string): Promise<boolean> {
  const key = `velocity:${userId}:${action}`;
  const count = await redis.incr(key);
  await redis.expire(key, 3600); // 1 hour window

  const limits: Record<string, number> = {
    'payment_attempt': 5,
    'login_attempt': 10,
    'password_reset': 3,
  };

  return count <= (limits[action] || 5);
}

// Device fingerprinting
async function checkDeviceFingerprint(userId: string, fingerprint: string) {
  const knownDevices = await db.userDevices.findMany({
    where: { user_id: userId },
  });

  if (!knownDevices.some(d => d.fingerprint === fingerprint)) {
    // New device -- require additional verification
    await sendVerificationEmail(userId);
    return false;
  }

  return true;
}
```

---

## Secure Session Management

### Payment Session Expiration

```typescript
// Create short-lived checkout session
const session = await stripe.checkout.sessions.create({
  // ... other params
  expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
});
```

### Idempotency Keys

```typescript
// Prevent duplicate charges
const paymentIntent = await stripe.paymentIntents.create({
  amount: 299,
  currency: 'usd',
}, {
  idempotencyKey: `order_${orderId}_${Date.now()}`,
});
```

---

## Logging and Monitoring

### What to Log

```typescript
// Log payment events (never log full card numbers)
logger.info('Payment initiated', {
  userId,
  amount,
  currency,
  paymentMethodType: paymentMethod.type,
  cardLast4: paymentMethod.card?.last4,  // Safe to log
  cardBrand: paymentMethod.card?.brand,  // Safe to log
});

// Log security events
logger.warn('Suspicious activity', {
  userId,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  event: 'multiple_failed_payments',
  count: failureCount,
});
```

### What NEVER to Log

- Full card numbers (PAN)
- CVV/CVC codes
- PINs
- Full track data
- Stripe secret keys
- Webhook signing secrets

---

## Content Security Policy (CSP)

### Recommended Headers

```typescript
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com https://checkout.stripe.com",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
    "img-src 'self' https://*.stripe.com data:",
    "style-src 'self' 'unsafe-inline'",
  ].join('; '));

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});
```

---

## Incident Response

### Card Data Breach Response

1. **Immediately** revoke all API keys in Stripe Dashboard
2. Generate new keys and update all systems
3. Notify Stripe security team
4. Engage PCI forensic investigator (PFI)
5. Notify affected customers
6. File reports with relevant authorities
7. Document timeline and remediation steps

### Suspicious Transaction Handling

```typescript
async function flagSuspiciousTransaction(paymentIntentId: string, reason: string) {
  // 1. Log the event
  await db.securityEvents.create({
    data: {
      event_type: 'suspicious_transaction',
      payment_intent_id: paymentIntentId,
      reason,
      timestamp: new Date(),
    },
  });

  // 2. Optionally hold the payment
  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: { flagged: 'true', flag_reason: reason },
  });

  // 3. Notify security team
  await notifySecurityTeam({ paymentIntentId, reason });
}
```

---

## Compliance Checklist

- [ ] Using Stripe Checkout, Elements, or Stripe.js (card data never on server)
- [ ] TLS 1.2+ on all pages
- [ ] All resources served over HTTPS
- [ ] Content Security Policy configured for Stripe
- [ ] Secret keys stored in environment variables only
- [ ] Webhook signatures verified
- [ ] Webhook endpoint uses raw body
- [ ] Idempotency keys for payment creation
- [ ] Server-side amount validation (never trust client)
- [ ] Velocity checks on payment attempts
- [ ] SCA/3DS handling for EU customers
- [ ] Fraud detection rules configured (Radar)
- [ ] Security headers set (HSTS, X-Frame-Options, etc.)
- [ ] Logging excludes sensitive card data
- [ ] Incident response plan documented
- [ ] Annual PCI SAQ completed
- [ ] API key rotation schedule in place
