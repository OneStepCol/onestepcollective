const Stripe = require('stripe');

const PRODUCTS = {
  mug: {
    name: 'A Rose a Day Mug',
    price: 1800,
    image: 'https://onestepcollective.com/images/mug.png',
  },
  tshirt: {
    name: 'A Rose a Day Tee',
    price: 3200,
    image: 'https://onestepcollective.com/images/tshirt.png',
  },
};

// Upcharge in cents above the base $32
const TSHIRT_UPCHARGE = {
  '2XL': 200,
  '3XL': 400,
  '4XL': 600,
  '5XL': 800,
};

module.exports = async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items in cart' });
    }

    const lineItems = items.map(item => {
      const product = PRODUCTS[item.productId];
      if (!product) throw new Error('Unknown product: ' + item.productId);

      const upcharge =
        item.productId === 'tshirt' ? (TSHIRT_UPCHARGE[item.size] || 0) : 0;

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.size ? `${product.name} — ${item.size}` : product.name,
            images: [product.image],
            metadata: {
              productId: item.productId,
              size: item.size || '',
            },
          },
          unit_amount: product.price + upcharge,
        },
        quantity: item.quantity || 1,
      };
    });

    const origin = req.headers.origin || 'https://onestepcollective.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 499, currency: 'usd' },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1299, currency: 'usd' },
            display_name: 'Express Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 2 },
              maximum: { unit: 'business_day', value: 3 },
            },
          },
        },
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/merch.html`,
      metadata: {
        items: JSON.stringify(items),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
