/**
 * Create a Stripe Subscription Price
 * Run with: npx tsx create-stripe-price.ts
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

async function createSubscriptionPrice() {
  console.log('\n🎯 Creating Stripe Subscription Price\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Create a product
    console.log('📦 Creating product...');
    const product = await stripe.products.create({
      name: 'UnHabit Premium',
      description: 'Premium subscription for UnHabit app',
    });
    console.log(`✅ Product created: ${product.id}`);
    console.log(`   Name: ${product.name}`);

    // Step 2: Create a recurring price
    console.log('\n💰 Creating recurring price...');
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 999, // $9.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });
    console.log(`✅ Price created: ${price.id}`);
    console.log(`   Amount: $${(price.unit_amount! / 100).toFixed(2)}`);
    console.log(`   Interval: ${price.recurring?.interval}`);

    // Step 3: Show instructions
    console.log('\n' + '='.repeat(50));
    console.log('✅ Success! Update your .env file:');
    console.log('='.repeat(50));
    console.log(`\nSTRIPE_PRICE_ID="${price.id}"\n`);
    console.log('='.repeat(50));
    console.log('\n📝 Next Steps:');
    console.log('1. Copy the STRIPE_PRICE_ID above');
    console.log('2. Update your .env file');
    console.log('3. Restart the backend server');
    console.log('4. Run the test again: npx tsx test-stripe-integration.ts');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createSubscriptionPrice();
