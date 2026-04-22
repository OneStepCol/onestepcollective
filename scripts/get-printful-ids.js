// scripts/get-printful-ids.js
// Fetches all store products and prints product + variant IDs

const API_KEY  = process.env.PRINTFUL_API_KEY  || 'TEbAvg5e7HcqeDTzRbxvq2odWGx6BWqFTTVHIMbX';
const STORE_ID = process.env.PRINTFUL_STORE_ID || '18056120';

async function run() {
  // 1. Get all store products
  const listRes = await fetch('https://api.printful.com/store/products', {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'X-PF-Store-Id': STORE_ID,
    },
  });

  const listData = await listRes.json();

  if (!listRes.ok) {
    console.error('Error fetching products:', JSON.stringify(listData, null, 2));
    process.exit(1);
  }

  const products = listData.result;
  console.log(`\nFound ${products.length} product(s) in store ${STORE_ID}\n`);
  console.log('='.repeat(60));

  // 2. For each product, fetch full details including variants
  for (const p of products) {
    const detailRes = await fetch(`https://api.printful.com/store/products/${p.id}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'X-PF-Store-Id': STORE_ID,
      },
    });

    const detailData = await detailRes.json();

    if (!detailRes.ok) {
      console.error(`Error fetching product ${p.id}:`, detailData);
      continue;
    }

    const product  = detailData.result.sync_product;
    const variants = detailData.result.sync_variants;

    console.log(`\nPRODUCT: ${product.name}`);
    console.log(`  Store Product ID : ${product.id}`);
    console.log(`  Variants (${variants.length}):`);

    for (const v of variants) {
      console.log(`    - Variant ID: ${v.id}  |  Name: ${v.name}  |  SKU: ${v.sku || 'n/a'}  |  Retail: $${(v.retail_price || '?')}`);
    }

    console.log('-'.repeat(60));
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
