// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'paused'],
    required: true
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  metadata: {
    paymentLinkId: String,
    source: String, // 'payment_link', 'checkout', etc.
    originalPlan: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to create subscription from Stripe event
subscriptionSchema.statics.createFromStripeEvent = async function(subscription, customerId) {
  const User = require('./User');
  
  // Find user by Stripe customer ID
  const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
  if (!user) {
    throw new Error('User not found for customer ID: ' + customerId);
  }
  
  // Extract plan from price ID
  const plan = this.extractPlanFromPriceId(subscription.items.data[0].price.id);
  
  // Create or update subscription
  const subscriptionDoc = await this.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      userId: user._id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      plan,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  
  // Update user subscription status
  user.subscription.status = subscription.status;
  user.subscription.plan = plan;
  user.subscription.stripeSubscriptionId = subscription.id;
  user.subscription.startDate = new Date(subscription.current_period_start * 1000);
  user.subscription.endDate = new Date(subscription.current_period_end * 1000);
  user.updatePlanLimits();
  await user.save();
  
  return subscriptionDoc;
};

subscriptionSchema.statics.extractPlanFromPriceId = function(priceId) {
  // Map your Stripe price IDs to plan names
  const priceMapping = {
    'price_basic_monthly': 'basic',
    'price_pro_monthly': 'pro', 
    'price_enterprise_monthly': 'enterprise',
    // Add your actual Stripe price IDs here
  };
  
  return priceMapping[priceId] || 'basic';
};

module.exports = mongoose.model('Subscription', subscriptionSchema);