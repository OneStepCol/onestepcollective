const Stripe = require('stripe');

// Disable Vercel's body parser — Stripe needs the raw body to verify signatures
module.exports.config = {
  api: { bodyParser: false },
};

// Printful sync variant IDs — fetched via scripts/get-printful-ids.js
const PRINTFUL_VARIANTS = {
  mug: {
    default: 5276084914,
  },
  tshirt: {
    XS:    5276087179,
    S:     5276087180,
    M:     5276087181,
    L:     5276087182,
    XL:    5276087183,
    '2XL': 5276087184,
    '3XL': 5276087185,
    '4XL': 5276087186,
    '5XL': 5276087187,
  },
};

// Collect raw body from the request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  try {
    // Retrieve full session with shipping details
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'shipping_details'],
    });

    const shipping = fullSession.shipping_details;
    const addr = shipping.address;

    // Parse items stored in session metadata
    const items = JSON.parse(session.metadata.items || '[]');

    const printfulItems = items.map(item => {
      const variantMap = PRINTFUL_VARIANTS[item.productId];
      const variantId = item.size ? variantMap[item.size] : variantMap.default;
      return {
        variant_id: variantId,
        quantity: item.quantity || 1,
      };
    });

    const printfulOrder = {
      recipient: {
        name: shipping.name,
        address1: addr.line1,
        address2: addr.line2 || '',
        city: addr.city,
        state_code: addr.state,
        country_code: addr.country,
        zip: addr.postal_code,
      },
      items: printfulItems,
    };

    const printfulRes = await fetch('https://api.printful.com/orders?confirm=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printfulOrder),
    });

    const printfulData = await printfulRes.json();

    if (!printfulRes.ok) {
      console.error('Printful order error:', JSON.stringify(printfulData));
      return res.status(500).json({ error: 'Printful order failed', detail: printfulData });
    }

    console.log('Printful order created:', printfulData.result?.id);
    return res.status(200).json({ received: true, printfulOrderId: printfulData.result?.id });

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
