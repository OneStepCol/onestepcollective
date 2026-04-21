const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Printful variant IDs — update with your actual Printful product/variant IDs
// after running: GET https://api.printful.com/store/products (with your store ID)
const PRINTFUL_VARIANTS = {
  mug: {
    default: 19239, // placeholder — replace with real Printful variant ID
  },
  tshirt: {
    XS:  '4011',
    S:   '4012',
    M:   '4013',
    L:   '4014',
    XL:  '4015',
    '2XL': '4016',
    '3XL': '4017',
    '4XL': '4018',
    '5XL': '4019',
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body — Vercel must forward raw body (see vercel.json)
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
    // Retrieve full session with line items and shipping
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

    const printfulRes = await fetch(
      `https://api.printful.com/orders?confirm=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
          'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(printfulOrder),
      }
    );

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
