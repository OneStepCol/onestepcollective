const Stripe = require('stripe');

// Printful sync_variant_ids — store variants with print files already attached
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

const handler = async (req, res) => {
  console.log('Webhook received:', req.method);

  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    console.log('Raw body length:', rawBody.length);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log('Event type:', event.type);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  try {
    // Retrieve full session — shipping_details is returned directly, only line_items needs expanding
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items'],
    });

    const shipping = fullSession.collected_information?.shipping_details;
    const addr = shipping?.address;

    // Parse items stored in session metadata
    const items = JSON.parse(session.metadata.items || '[]');

    const printfulItems = items.map(item => {
      const variantMap = PRINTFUL_VARIANTS[item.productId];
      const syncVariantId = item.size ? variantMap[item.size] : variantMap.default;
      return {
        sync_variant_id: syncVariantId,
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

    console.log('Creating Printful order for session:', session.id);

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

// Config must be set on the handler reference AFTER it's defined,
// otherwise module.exports = handler would overwrite it.
handler.config = {
  api: { bodyParser: false },
};

module.exports = handler;
