// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

console.log('👤 User model loaded:', typeof User);

// Helper function to format user data with all info
const formatUserData = (user) => {
  const creditsInfo = user.creditsInfo;
  const videoLibrary = user.videoLibrary;
  const imageLibrary = user.imageLibrary;
  
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    subscription: user.subscription,
    usage: user.usage,
    hasActiveSubscription: user.hasActiveSubscription,
    canGenerateVideos: user.canGenerateVideos,
    
    // 🪙 Credits information
    credits: {
      available: user.credits?.available || 3,
      used: user.credits?.used || 0,
      totalPurchased: user.credits?.totalPurchased || 0,
      canGenerateImages: creditsInfo.canGenerateImages,
      lastPurchase: user.credits?.lastPurchase,
      packages: user.credits?.packages || []
    },
    
    // 🖼️ Images information
    images: {
      totalImages: imageLibrary.totalImages,
      totalSize: imageLibrary.totalSize,
      thisMonth: imageLibrary.thisMonth,
      totalCreditsUsed: imageLibrary.totalCreditsUsed,
      models: imageLibrary.models,
      styles: imageLibrary.styles
    },
    
    // 🎬 Videos information (enhanced)
    videos: {
      totalVideos: videoLibrary.totalVideos,
      totalSize: videoLibrary.totalSize,
      thisMonth: videoLibrary.thisMonth,
      batchCount: videoLibrary.batchCount,
      languages: videoLibrary.languages,
      models: videoLibrary.models
    }
  };
};

// Test route - simple user creation
router.post('/test-create-user', async (req, res) => {
  try {
    console.log('🧪 TEST: Creating simple user...');
    
    const testUser = new User({
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser123',
      email: 'test123@test.com',
      password: 'password123'
    });
    
    console.log('🧪 TEST: User object created');
    
    const saved = await testUser.save();
    console.log('🧪 TEST: User saved!', saved._id);
    
    res.json({ success: true, userId: saved._id, email: saved.email });
  } catch (error) {
    console.error('🧪 TEST ERROR:', error);
    res.json({ success: false, error: error.message, type: error.name });
  }
});

router.post('/register', async (req, res) => {
  console.log('🚀 REGISTER ROUTE HIT!');
  console.log('📝 Raw request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { firstName, lastName, username, email, password } = req.body;
    
    // Check if all fields exist
    console.log('🔍 Field validation:');
    console.log('  firstName:', firstName, typeof firstName);
    console.log('  lastName:', lastName, typeof lastName);
    console.log('  username:', username, typeof username);
    console.log('  email:', email, typeof email);
    console.log('  password:', password ? '***' : 'MISSING', typeof password);
    
    // Check for missing fields
    if (!firstName || !lastName || !username || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'All fields required',
        missing: {
          firstName: !firstName,
          lastName: !lastName,
          username: !username,
          email: !email,
          password: !password
        }
      });
    }
    
    console.log('✅ All fields present');
    
    console.log('🔍 Checking existing user...');
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    console.log('🔍 Existing user check result:', existingUser ? 'FOUND' : 'NOT FOUND');
    
    if (existingUser) {
      console.log('❌ User already exists:', existingUser.email || existingUser.username);
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }
    
    console.log('👤 Creating new user object...');
    
    // Create user step by step
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: password
    };
    
    console.log('👤 User data prepared:', { ...userData, password: '***' });
    
    const user = new User(userData);
    console.log('👤 User object created, validating...');
    
    // Manual validation
    const validationError = user.validateSync();
    if (validationError) {
      console.log('❌ Validation error:', validationError.message);
      console.log('❌ Validation details:', validationError.errors);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError.message
      });
    }
    
    console.log('✅ Validation passed');
    console.log('💾 Attempting to save user...');
    
    const savedUser = await user.save();
    console.log('✅ User saved successfully!');
    console.log('✅ User ID:', savedUser._id);
    console.log('✅ User email:', savedUser.email);
    console.log('🪙 User credits:', savedUser.credits);
    
    // Verify user was actually saved
    const verifyUser = await User.findById(savedUser._id);
    console.log('🔍 Verification - user found in DB:', verifyUser ? 'YES' : 'NO');
    
    console.log('🔑 Creating JWT token...');
    const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('🔑 Token created');
    
    console.log('🎉 Sending success response');
    res.status(201).json({
      success: true,
      token,
      user: formatUserData(savedUser)
    });
    
  } catch (error) {
    console.error('❌ REGISTRATION ERROR:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Check for specific mongoose errors
    if (error.name === 'ValidationError') {
      console.error('❌ Mongoose validation error:', error.errors);
    }
    if (error.code === 11000) {
      console.error('❌ Duplicate key error:', error.keyPattern);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      type: error.name
    });
  }
});

router.post('/login', async (req, res) => {
  console.log('🔐 LOGIN ROUTE HIT!');
  console.log('📝 Request body:', { email: req.body.email, password: '***' });
  
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Looking for user with email:', email);
    const user = await User.findOne({ email });
    console.log('👤 User found:', user ? 'YES' : 'NO');
    
    if (!user) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    console.log('🔐 Testing password...');
    const isMatch = await user.comparePassword(password);
    console.log('🔐 Password match:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password does not match');
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    console.log('✅ Login successful for:', user.email);
    console.log('🪙 User credits on login:', user.credits);
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      token,
      user: formatUserData(user)
    });
  } catch (error) {
    console.error('❌ LOGIN ERROR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔄 UPDATED: Enhanced /me route with credits and images
router.get('/me', requireAuth, async (req, res) => {
  try {
    console.log('👤 Getting user profile for:', req.user._id);
    
    // Get fresh user data with all populated fields
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log('📊 User profile stats:', {
      email: user.email,
      credits: user.credits,
      totalImages: user.generatedImages?.length || 0,
      totalVideos: user.generatedVideos?.length || 0,
      subscription: user.subscription.plan
    });
    
    res.json({
      success: true,
      user: formatUserData(user)
    });
    
  } catch (error) {
    console.error('❌ GET /me ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🆕 NEW: Get detailed user statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const subscriptionInfo = user.getSubscriptionInfo();
    
    res.json({
      success: true,
      stats: subscriptionInfo
    });
    
  } catch (error) {
    console.error('❌ GET /stats ERROR:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({ success: true, message: 'Reset link sent if email exists' });
    }
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    
    console.log(`Reset URL: http://localhost:3000/reset-password.html?token=${resetToken}`);
    
    res.json({ success: true, message: 'Reset link sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;