// scripts/get-printful-ids.js
// Fetches all store products and prints both sync variant IDs and real variant IDs

const API_KEY  = process.env.PRINTFUL_API_KEY  || 'TEbAvg5e7HcqeDTzRbxvq2odWGx6BWqFTTVHIMbX';
const STORE_ID = process.env.PRINTFUL_STORE_ID || '18056120';

async function run() {
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
  console.log('='.repeat(70));

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
    console.log(`  Store Product ID (sync_product_id) : ${product.id}`);
    console.log(`  Variants (${variants.length}):`);
    console.log(`  ${'Name'.padEnd(30)} ${'sync_variant_id'.padEnd(18)} ${'variant_id (USE THIS)'.padEnd(22)} SKU`);
    console.log(`  ${'-'.repeat(85)}`);

    for (const v of variants) {
      const name    = v.name.padEnd(30);
      const syncId  = String(v.id).padEnd(18);
      const realId  = String(v.variant_id).padEnd(22);
      const sku     = v.sku || 'n/a';
      console.log(`  ${name} ${syncId} ${realId} ${sku}`);
    }

    console.log('-'.repeat(70));
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
