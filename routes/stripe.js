// routes/stripe.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

console.log('🎯 Stripe routes loaded');

// Initialize Stripe (add this to your package.json: npm install stripe)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key_here');

// Plan configuration
const PLANS = {
  starter: {
    name: 'Starter',
    price: 45,
    videoLimit: 5,
    // MOCK payment link voor testing - redirect direct terug met success
    paymentLink: 'https://buy.stripe.com/14A28r6Oz6Rx44q8aOgbm09'
  },
  pro: {
    name: 'Pro', 
    price: 135,
    videoLimit: 15,
    // MOCK payment link voor testing
    paymentLink: 'https://buy.stripe.com/28E6oHfl5gs7dF062Ggbm08'
  },
  business: {
    name: 'Business',
    price: 270, 
    videoLimit: 30,
    // MOCK payment link voor testing
    paymentLink: 'https://buy.stripe.com/aFaaEX0qb6Rx1Wiezcgbm07'
  }
};

// Test route
router.get('/test', (req, res) => {
    console.log('🧪 Stripe test route hit');
    res.json({ 
      success: true, 
      message: 'Stripe routes working!',
      timestamp: new Date().toISOString()
    });
  });
  
  // Get available plans
  router.get('/plans', (req, res) => {
    console.log('📋 Plans route hit');
    res.json({
      success: true,
      plans: PLANS
    });
  });
  
  // Create payment link with subscription management
  router.post('/create-payment-link', requireAuth, async (req, res) => {
    try {
      console.log('🎯 Create payment link route hit');
      console.log('📝 Request body:', req.body);
      console.log('👤 User:', req.user._id);
      
      const { plan, price, videoLimit, userId } = req.body;
      
      console.log('🎯 Creating payment link for:', { plan, price, videoLimit, userId });
      
      // Validate plan
      if (!PLANS[plan]) {
        console.log('❌ Invalid plan:', plan);
        return res.status(400).json({
          success: false,
          error: 'Invalid plan selected'
        });
      }
      
      const planConfig = PLANS[plan];
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Check if user has an existing subscription
      if (user.subscription.stripeSubscriptionId && user.subscription.plan !== 'free') {
        console.log('⚠️ User has existing subscription:', user.subscription.plan);
        
        // Option 1: Return warning that requires manual cancellation
        return res.json({
          success: false,
          error: 'EXISTING_SUBSCRIPTION',
          message: `You already have an active ${user.subscription.plan} subscription. Please cancel it first or use the upgrade option.`,
          currentPlan: user.subscription.plan,
          newPlan: plan,
          requiresCancellation: true
        });
      }
      
      console.log('📋 Plan config:', planConfig);
      
      // Clean Stripe Payment URL
      const paymentUrl = planConfig.paymentLink;
      
      console.log('🎯 Clean Stripe Payment URL:', paymentUrl);
      
      res.json({
        success: true,
        paymentUrl: paymentUrl,
        plan: planConfig,
        message: `Redirecting to ${planConfig.name} plan checkout`
      });
      
    } catch (error) {
      console.error('❌ Payment link creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payment link'
      });
    }
  });
  
  // Smart upgrade: Cancel old subscription and redirect to new plan
  router.post('/smart-upgrade', requireAuth, async (req, res) => {
    try {
      console.log('🔄 Smart upgrade route hit');
      console.log('📝 Request body:', req.body);
      console.log('👤 User ID:', req.user._id);
      
      const { plan } = req.body;
      
      if (!plan || !PLANS[plan]) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan selected'
        });
      }
      
      const user = await User.findById(req.user._id);
      const planConfig = PLANS[plan];
      
      // Step 1: Cancel existing subscription if exists
      if (user.subscription.stripeSubscriptionId && user.subscription.plan !== 'free') {
        console.log('❌ Cancelling existing subscription:', user.subscription.stripeSubscriptionId);
        
        try {
          // Cancel the subscription in Stripe
          const cancelledSubscription = await stripe.subscriptions.cancel(
            user.subscription.stripeSubscriptionId
          );
          
          console.log('✅ Stripe subscription cancelled:', cancelledSubscription.id);
          
          // Update user to free plan temporarily
          user.subscription.plan = 'free';
          user.subscription.status = 'inactive';
          user.subscription.stripeSubscriptionId = null;
          user.usage.monthlyLimit = 3;
          await user.save();
          
          console.log('✅ User downgraded to free plan');
          
        } catch (stripeError) {
          console.error('❌ Error cancelling Stripe subscription:', stripeError);
          
          // If Stripe cancel fails, still proceed but log the error
          console.log('⚠️ Proceeding with upgrade despite Stripe cancellation error');
        }
      }
      
      // Step 2: Return payment link for new plan
      const paymentUrl = planConfig.paymentLink;
      
      console.log('🎯 Smart upgrade payment URL:', paymentUrl);
      
      res.json({
        success: true,
        paymentUrl: paymentUrl,
        plan: planConfig,
        message: `Old subscription cancelled. Redirecting to ${planConfig.name} plan checkout.`,
        upgraded: true
      });
      
    } catch (error) {
      console.error('❌ Smart upgrade error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process upgrade',
        details: error.message
      });
    }
  });
  
  // Cancel current subscription
  router.post('/cancel-subscription', requireAuth, async (req, res) => {
    try {
      console.log('❌ Cancel subscription route hit for user:', req.user._id);
      
      const user = await User.findById(req.user._id);
      
      if (!user.subscription.stripeSubscriptionId) {
        return res.status(400).json({
          success: false,
          error: 'No active subscription to cancel'
        });
      }
      
      // Cancel in Stripe
      try {
        const cancelledSubscription = await stripe.subscriptions.cancel(
          user.subscription.stripeSubscriptionId
        );
        
        console.log('✅ Stripe subscription cancelled:', cancelledSubscription.id);
      } catch (stripeError) {
        console.error('❌ Stripe cancellation error:', stripeError);
        // Continue with local cancellation even if Stripe fails
      }
      
      // Update user status
      user.subscription.status = 'inactive';
      user.subscription.plan = 'free';
      user.subscription.stripeSubscriptionId = null;
      user.usage.monthlyLimit = 3;
      await user.save();
      
      console.log('✅ Subscription cancelled for user:', req.user._id);
      
      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });
      
    } catch (error) {
      console.error('❌ Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription'
      });
    }
  });
  
  // TEMPORARY: Manual subscription update for testing
  router.post('/manual-update-subscription', requireAuth, async (req, res) => {
    try {
      console.log('🔧 Manual update subscription route hit');
      console.log('📝 Request body:', req.body);
      console.log('👤 User ID:', req.user._id);
      
      const { plan } = req.body;
      
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: 'Plan is required'
        });
      }
      
      if (!PLANS[plan]) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan selected'
        });
      }
      
      console.log('🔧 MANUAL: Updating subscription for testing', { userId: req.user._id, plan });
      
      const updatedUser = await updateUserSubscription(req.user._id, plan);
      
      res.json({
        success: true,
        message: `Subscription updated to ${plan} plan`,
        plan: PLANS[plan],
        user: {
          subscription: updatedUser.subscription,
          usage: updatedUser.usage
        },
        note: 'This is for testing only - in production this happens via Stripe webhooks'
      });
      
    } catch (error) {
      console.error('❌ Manual subscription update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update subscription',
        details: error.message
      });
    }
  });
  
  // Get current subscription status
  router.get('/subscription-status', requireAuth, async (req, res) => {
    try {
      console.log('📊 Subscription status route hit for user:', req.user._id);
      
      const user = await User.findById(req.user._id);
      
      const subscriptionInfo = {
        plan: user.subscription.plan,
        status: user.subscription.status,
        videoLimit: user.usage.monthlyLimit,
        videosUsed: user.usage.videosGenerated,
        hasActiveSubscription: user.hasActiveSubscription,
        canGenerateVideos: user.canGenerateVideos,
        stripeSubscriptionId: user.subscription.stripeSubscriptionId || null
      };
      
      console.log('📊 Subscription info:', subscriptionInfo);
      
      res.json({
        success: true,
        subscription: subscriptionInfo
      });
      
    } catch (error) {
      console.error('❌ Subscription status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get subscription status'
      });
    }
  });
  
  // Update user subscription after successful payment
  async function updateUserSubscription(userId, planName, stripeSubscriptionId = null) {
    try {
      console.log('🔄 Updating user subscription:', { userId, planName, stripeSubscriptionId });
      
      const planConfig = PLANS[planName];
      if (!planConfig) {
        console.error('❌ Invalid plan:', planName);
        throw new Error('Invalid plan: ' + planName);
      }
      
      const user = await User.findById(userId);
      if (!user) {
        console.error('❌ User not found:', userId);
        throw new Error('User not found: ' + userId);
      }
      
      console.log('👤 Current user subscription:', {
        plan: user.subscription.plan,
        status: user.subscription.status,
        videoLimit: user.usage.monthlyLimit,
        videosUsed: user.usage.videosGenerated,
        stripeSubscriptionId: user.subscription.stripeSubscriptionId
      });
      
      // Update user subscription
      user.subscription.plan = planName;
      user.subscription.status = 'active';
      user.usage.monthlyLimit = planConfig.videoLimit;
      user.usage.videosGenerated = 0; // Reset for new billing period
      
      // Store Stripe subscription ID if provided
      if (stripeSubscriptionId) {
        user.subscription.stripeSubscriptionId = stripeSubscriptionId;
      }
      
      await user.save();
      
      console.log('✅ User subscription updated successfully');
      console.log('📊 New subscription details:', {
        plan: user.subscription.plan,
        status: user.subscription.status,
        videoLimit: user.usage.monthlyLimit,
        videosUsed: user.usage.videosGenerated,
        stripeSubscriptionId: user.subscription.stripeSubscriptionId
      });
      
      return user;
      
    } catch (error) {
      console.error('❌ Error updating user subscription:', error);
      throw error;
    }
  }
  
  // Webhook to handle successful payments (PRODUCTION ONLY)
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('🔔 Stripe webhook received (Production only)');
    
    // TODO: Enable this in production with proper webhook endpoint
    // For local development, we handle subscription updates manually
    
    res.json({ received: true, message: 'Webhook endpoint ready for production' });
  });
  
  module.exports = router;