// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Require authentication
const requireAuth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Add FULL user object to request (FIXED)
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      error: 'Invalid token' 
    });
  }
};

// Require subscription (not free tier)
const requireSubscription = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    // Get fresh user data from database
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    console.log('🔍 Subscription check:', {
      userId: user._id,
      plan: user.subscription.plan,
      status: user.subscription.status,
      hasActiveSubscription: user.hasActiveSubscription
    });

    // Check if user has active subscription (not free)
    if (!user.hasActiveSubscription) {
      return res.status(403).json({ 
        success: false,
        error: 'Active subscription required',
        currentPlan: user.subscription.plan,
        status: user.subscription.status,
        upgradeUrl: '/pricing'
      });
    }

    // Update req.user with fresh data
    req.user = user;
    next();

  } catch (error) {
    console.error('Subscription middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Check video limits
const checkVideoLimits = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    // Get fresh user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    console.log('🔍 Video limits check:', {
      userId: user._id,
      videosGenerated: user.usage.videosGenerated,
      monthlyLimit: user.usage.monthlyLimit,
      canGenerate: user.canGenerateVideos
    });

    // Check if user has reached video limit
    if (!user.canGenerateVideos) {
      return res.status(403).json({ 
        success: false,
        error: 'Monthly video limit reached',
        videoCount: user.usage.videosGenerated,
        videoLimit: user.usage.monthlyLimit,
        upgradeUrl: '/pricing'
      });
    }

    // Increment video count
    await User.findByIdAndUpdate(user._id, { 
      $inc: { 'usage.videosGenerated': 1 } 
    });

    // Update req.user with fresh data
    req.user = user;
    next();

  } catch (error) {
    console.error('Video limits middleware error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 🖼️ NEW: Check image credits
const checkImageCredits = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get fresh user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('🎨 Image credits check:', {
      userId: user._id,
      creditsAvailable: user.credits.available,
      creditsUsed: user.credits.used
    });

    // Check if user has credits
    if (user.credits.available < 1) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate an image',
        credits: {
          available: user.credits.available,
          needed: 1
        },
        redirectTo: '/credits'
      });
    }

    // Update req.user with fresh data
    req.user = user;
    next();

  } catch (error) {
    console.error('Image credits middleware error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Export all middleware functions
module.exports = {
  requireAuth,
  requireSubscription,
  checkVideoLimits,
  checkImageCredits  // 🆕 Added
};