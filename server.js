// server.js - COMPLETE VIDCRAFT AI WITH GPT-IMAGE-1 + VEO3 VIDEO GENERATION + ALL FEATURES
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const FormData = require('form-data');
require('dotenv').config();

// Stripe for image credits
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const User = require('./models/User');

// OpenAI for image generation
const OpenAI = require('openai');
const { checkImageCredits } = require('./middleware/auth'); // Image credits middleware

// Import auth/stripe routes BUT NOT THE QUOTA CHECKING MIDDLEWARE
let authRoutes, stripeRoutes, requireAuth, requireSubscription;

try {
  if (fs.existsSync('./routes/auth.js')) {
    authRoutes = require('./routes/auth');
  }
  if (fs.existsSync('./routes/stripe.js')) {
    stripeRoutes = require('./routes/stripe');
  }
  if (fs.existsSync('./middleware/auth.js')) {
    const authMiddleware = require('./middleware/auth');
    requireAuth = authMiddleware.requireAuth;
    requireSubscription = authMiddleware.requireSubscription;
    console.log('✅ Auth middleware imported');
  }
} catch (error) {
  console.warn('⚠️ Auth/stripe modules not found');
}

// FALLBACK: Create our own simple auth middleware if external not available
if (!requireAuth) {
  console.log('🔧 Creating fallback auth middleware');
  requireAuth = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const User = mongoose.model('User');
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const user = await User.findById(decoded.userId || decoded.id);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Import VEO3 modules for video generation
let CharacterAnalyzer, ProductAnalyzer, PromptGenerator, VEO3Generator, CreatomateEditor;

try {
  CharacterAnalyzer = require('./modules/CharacterAnalyzer');
  ProductAnalyzer = require('./modules/ProductAnalyzer');
  PromptGenerator = require('./modules/PromptGenerator');
  VEO3Generator = require('./modules/VEO3Generator');
  CreatomateEditor = require('./modules/CreatomateEditor');
  console.log('✅ All VEO3 modules imported successfully');
} catch (error) {
  console.error('❌ VEO3 module import error:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vidcraft-ai';
mongoose.connect(mongoUri)
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('💡 Running without database features');
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for multi-image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Debug middleware
app.use('*', (req, res, next) => {
  if (!req.originalUrl.includes('/api/batch-status/')) {
    console.log(`📡 Request: ${req.method} ${req.originalUrl}`);
  }
  next();
});

// OpenAI Setup for image generation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ENHANCED: Directory Setup for both images and videos
const ensureDirectories = () => {
  const dirs = [
    './images', 
    './product-images', 
    './uploads', 
    './uploads/images',  // For image uploads
    './generated-videos', 
    './edited-videos',
    './generated/images'  // For generated images
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      } catch (error) {
        console.error(`❌ Failed to create directory ${dir}:`, error.message);
      }
    } else {
      console.log(`✅ Directory exists: ${dir}`);
    }
  });
};

// Call this immediately
ensureDirectories();

// Initialize VEO3 modules
let characterAnalyzer, productAnalyzer, promptGenerator, veo3Generator, creatomateEditor;

try {
  if (CharacterAnalyzer) characterAnalyzer = new CharacterAnalyzer();
  if (ProductAnalyzer) productAnalyzer = new ProductAnalyzer();
  if (PromptGenerator) promptGenerator = new PromptGenerator();
  if (VEO3Generator) veo3Generator = new VEO3Generator();
  if (CreatomateEditor) creatomateEditor = new CreatomateEditor();
  console.log('✅ All VEO3 modules initialized successfully');
} catch (error) {
  console.error('❌ VEO3 module initialization error:', error.message);
}

// ENHANCED: Status checking and pending tracking with VIDEO STORAGE
const activeBatches = new Map();
const completedVideos = new Map();
const batchStatusCache = new Map();
const pendingGenerations = new Map();

// Clean up old batches and pending generations
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (const [batchId, batch] of activeBatches.entries()) {
    if (now - new Date(batch.startTime).getTime() > oneDay) {
      activeBatches.delete(batchId);
      batchStatusCache.delete(batchId);
    }
  }
  
  for (const [batchId, pending] of pendingGenerations.entries()) {
    const age = now - new Date(pending.startTime).getTime();
    if (age > oneDay) {
      console.log(`🧹 Cleaning up old pending generation: ${batchId} (age: ${Math.round(age / 1000 / 60)} minutes)`);
      pendingGenerations.delete(batchId);
    }
  }
}, 60 * 60 * 1000);

// ENHANCED: Multi-Storage Multer Setup for both images and videos
// 1. Image storage for GPT-Image-1 multi-image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/images';
    
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`📁 Created upload directory: ${uploadDir}`);
      } catch (error) {
        console.error(`❌ Failed to create upload directory:`, error);
        return cb(error);
      }
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const extension = path.extname(file.originalname) || '.png';
      const filename = `${userId}_${timestamp}_${randomId}${extension}`;
      
      console.log(`📝 Saving image file as: ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error('❌ Error generating image filename:', error);
      cb(error);
    }
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    console.log(`🔍 Image file filter check: ${file.mimetype}`);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`❌ Image file type not allowed: ${file.mimetype}`);
      cb(new Error(`Only image files allowed. Got: ${file.mimetype}`), false);
    }
  },
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB per file for GPT-Image-1
    files: 10 // Max 10 files (GPT-Image-1 limit)
  }
});

// 2. Video character/product storage for VEO3
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.body.uploadType || 'character';
    const destDir = uploadType === 'character' ? './images' : './product-images';
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'demo';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}${extension}`);
  }
});

const videoUpload = multer({ 
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Auth and Stripe routes
if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('🔧 Auth routes registered');
}

if (stripeRoutes) {
  app.use('/api/stripe', stripeRoutes);
  console.log('🔧 Stripe routes registered');
}

// CUSTOM AUTH MIDDLEWARE for video generation
const customAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access this feature'
      });
    }

    console.log(`🔐 Custom auth check for token: ${token.substring(0, 20)}...`);

    const User = mongoose.model('User');
    
    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = decoded.userId || decoded.id || decoded.sub;
      console.log(`🔍 Decoded user ID from JWT: ${userId}`);
    } catch (jwtError) {
      console.log(`⚠️ JWT decode failed, trying direct token lookup`);
      const userByToken = await User.findOne({ 'tokens.token': token });
      if (userByToken) {
        userId = userByToken._id;
        console.log(`🔍 Found user by token lookup: ${userId}`);
      }
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token',
        message: 'Please log in again'
      });
    }

    const user = await User.findById(userId)
      .select('firstName lastName email subscription usage hasActiveSubscription createdAt generatedVideos generatedImages credits')
      .lean();

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found',
        message: 'Your account could not be found'
      });
    }

    console.log(`✅ Custom auth successful for user: ${user.email}`);
    
    req.user = {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      subscription: user.subscription,
      usage: user.usage,
      hasActiveSubscription: user.hasActiveSubscription,
      generatedVideos: user.generatedVideos || [],
      generatedImages: user.generatedImages || [],
      credits: user.credits || { available: 0, used: 0, totalPurchased: 0 }
    };

    next();

  } catch (error) {
    console.error('❌ Custom auth error:', error);
    return res.status(401).json({ 
      success: false,
      error: 'Authentication failed',
      message: 'Please log in again'
    });
  }
};

// ENHANCED PLAN DETECTION - BUSINESS PLAN SUPPORT
function detectUserPlan(subscription, usage) {
  console.log(`🔍 Detecting plan from subscription:`, JSON.stringify(subscription, null, 2));
  console.log(`🔍 Usage data:`, JSON.stringify(usage, null, 2));
  
  if (!subscription) {
    console.log(`❌ No subscription object found`);
    return { limit: 1, source: 'no subscription' };
  }
  
  if (usage && usage.monthlyLimit && subscription.status === 'active') {
    console.log(`✅ Found existing monthlyLimit in usage: ${usage.monthlyLimit}`);
    return { 
      limit: usage.monthlyLimit, 
      source: `existing usage.monthlyLimit = ${usage.monthlyLimit} (status: ${subscription.status})` 
    };
  }
  
  const possiblePlanFields = ['plan', 'planName', 'tier', 'type', 'subscriptionType', 'level'];
  let planValue = null;
  let planField = null;
  
  for (const field of possiblePlanFields) {
    if (subscription[field]) {
      planValue = subscription[field];
      planField = field;
      break;
    }
  }
  
  if (!planValue) {
    console.log(`❌ No plan value found in any field:`, possiblePlanFields);
    return { limit: 1, source: 'no plan value found' };
  }
  
  const planLower = planValue.toString().toLowerCase();
  console.log(`🎯 Found plan value: "${planValue}" (${planLower}) in field: ${planField}`);
  
  if (planLower === 'pro' || planLower === 'professional') {
    console.log(`✅ Detected PRO plan - 5 videos`);
    return { limit: 5, source: `${planField} = "${planValue}"` };
  } else if (planLower === 'business' || planLower === 'corporate') {
    console.log(`✅ Detected BUSINESS plan - 30 videos`);
    return { limit: 30, source: `${planField} = "${planValue}"` };
  } else if (planLower === 'enterprise' || planLower === 'unlimited') {
    console.log(`✅ Detected ENTERPRISE plan - 100 videos`);
    return { limit: 100, source: `${planField} = "${planValue}"` };
  } else if (planLower === 'basic' || planLower === 'starter' || planLower === 'free') {
    console.log(`✅ Detected BASIC plan - 1 video`);
    return { limit: 1, source: `${planField} = "${planValue}"` };
  } else {
    if (subscription.status === 'active') {
      console.log(`⚠️ Unknown plan: "${planValue}" but subscription is active - giving business level access`);
      return { limit: 30, source: `unknown active plan: ${planField} = "${planValue}" (defaulted to business)` };
    } else {
      console.log(`⚠️ Unknown plan: "${planValue}" and not active - defaulting to basic`);
      return { limit: 1, source: `unknown inactive plan: ${planField} = "${planValue}"` };
    }
  }
}

function checkActiveSubscription(subscription) {
  if (!subscription) {
    console.log(`❌ No subscription object`);
    return false;
  }
  
  const statusFields = ['status', 'state', 'active', 'isActive'];
  let status = null;
  
  for (const field of statusFields) {
    if (subscription[field] !== undefined) {
      status = subscription[field];
      console.log(`🔍 Found subscription status in field '${field}': ${status}`);
      break;
    }
  }
  
  if (status === null) {
    console.log(`❌ No subscription status found in fields:`, statusFields);
    return false;
  }
  
  if (status === 'active' || status === 'Active' || status === true || status === 'ACTIVE') {
    console.log(`✅ Subscription is active`);
    return true;
  } else {
    console.log(`❌ Subscription status is: ${status} (not active)`);
    return false;
  }
}

// Video quota check with business plan support
const ourQuotaCheck = async (req, res, next) => {
  try {
    if (!req.user) {
      console.log('🔓 Demo mode - allowing video generation');
      return next();
    }

    console.log('\n🔍 SAFE QUOTA CHECK - FRESH DATABASE QUERY');
    console.log('═══════════════════════════════════════════════════');
    
    const User = mongoose.model('User');
    const freshUser = await User.findById(req.user.id)
      .select('subscription usage hasActiveSubscription email')
      .lean();
    
    if (!freshUser) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Your account could not be found. Please log in again.'
      });
    }

    console.log(`👤 User: ${freshUser.email}`);
    console.log(`📋 Fresh DB - Subscription:`, JSON.stringify(freshUser.subscription, null, 2));
    console.log(`📊 Fresh DB - Usage:`, JSON.stringify(freshUser.usage, null, 2));
    console.log(`🔓 Fresh DB - hasActiveSubscription field:`, freshUser.hasActiveSubscription);

    const subscription = freshUser.subscription || {};
    const usage = freshUser.usage || {};
    
    let hasActiveSubscription = false;
    
    if (freshUser.hasActiveSubscription === true) {
      hasActiveSubscription = true;
      console.log(`✅ Active subscription confirmed via hasActiveSubscription field`);
    }
    
    if (!hasActiveSubscription && checkActiveSubscription(subscription)) {
      hasActiveSubscription = true;
      console.log(`✅ Active subscription confirmed via subscription status check`);
    }
    
    if (!hasActiveSubscription && usage.monthlyLimit && usage.monthlyLimit > 1) {
      hasActiveSubscription = true;
      console.log(`✅ Active subscription assumed via monthlyLimit > 1 (${usage.monthlyLimit})`);
    }

    if (!hasActiveSubscription) {
      console.log(`❌ No active subscription detected`);
      return res.status(402).json({ 
        error: 'Subscription required',
        message: 'Please upgrade to a paid plan to generate videos',
        redirectTo: '/pricing',
        debug: {
          hasActiveSubscriptionField: freshUser.hasActiveSubscription,
          subscriptionStatus: subscription.status,
          monthlyLimit: usage.monthlyLimit
        }
      });
    }

    const planDetection = detectUserPlan(subscription, usage);
    let monthlyLimit = planDetection.limit;
    let planSource = planDetection.source;
    
    const videosUsed = usage.videosGenerated || 0;
    const videosRemaining = Math.max(0, monthlyLimit - videosUsed);

    console.log(`🎯 Plan Detection: ${planSource}`);
    console.log(`📈 Monthly Limit: ${monthlyLimit}`);
    console.log(`📹 Videos Used: ${videosUsed}`);
    console.log(`⏳ Videos Remaining: ${videosRemaining}`);

    if (videosRemaining <= 0) {
      console.log(`❌ QUOTA EXCEEDED - User has used ${videosUsed}/${monthlyLimit} videos`);
      return res.status(429).json({ 
        error: 'Monthly limit reached',
        message: `You've used all ${monthlyLimit} videos for this month. Upgrade for more!`,
        usage: {
          used: videosUsed,
          limit: monthlyLimit,
          remaining: 0
        },
        redirectTo: '/pricing'
      });
    }

    console.log(`✅ QUOTA OK - User can generate ${videosRemaining} more videos`);
    console.log('═══════════════════════════════════════════════════\n');

    req.userQuota = {
      used: videosUsed,
      limit: monthlyLimit,
      remaining: videosRemaining,
      canGenerate: true,
      planDetection: planSource,
      freshFromDatabase: true,
      safeQuotaSystem: true
    };

    next();

  } catch (error) {
    console.error('❌ Our quota check error:', error);
    req.userQuota = { used: 0, limit: 999, remaining: 999, canGenerate: true, error: error.message };
    next();
  }
};

// ENHANCED: Update user quota with video storage
async function updateUserVideoQuotaSafe(userId, videosGenerated, completedVideos = []) {
  try {
    const User = mongoose.model('User');
    
    const userExists = await User.findById(userId).select('_id');
    if (!userExists) {
      throw new Error(`User ${userId} not found when updating quota`);
    }
    
    // Prepare video entries for database
    const videoEntries = completedVideos.map(video => ({
      videoId: video.videoId || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: video.title || 'Generated Video',
      sceneNumber: video.sceneNumber || 1,
      batchId: video.batchId,
      googleStorageUrl: video.googleStorageUrl,
      publicUrl: video.publicUrl,
      localPath: video.localPath,
      size: video.size || 0,
      duration: video.duration || 8,
      prompt: video.prompt || '',
      dialogue: video.dialogue || '',
      createdAt: new Date(),
      metadata: {
        model: video.model || 'veo3-fast',
        aspectRatio: video.aspectRatio || '16:9',
        hasCharacter: video.hasCharacter || false,
        hasProduct: video.hasProduct || false,
        spokenLanguage: video.spokenLanguage || 'en'
      }
    }));
    
    const updateOperations = {
      $inc: { 'usage.videosGenerated': videosGenerated },
      $set: { 'usage.lastUpdate': new Date() }
    };
    
    // Add videos to the user's collection if we have them
    if (videoEntries.length > 0) {
      updateOperations.$addToSet = {
        generatedVideos: { $each: videoEntries }
      };
    }
    
    const result = await User.findByIdAndUpdate(
      userId, 
      updateOperations,
      { 
        new: true,
        upsert: false
      }
    );

    if (!result) {
      throw new Error(`Quota update failed for user ${userId}`);
    }

    console.log(`✅ SAFE quota update: +${videosGenerated} videos for user ${userId} (total: ${result.usage.videosGenerated})`);
    console.log(`💾 Saved ${videoEntries.length} videos to user's database collection`);
    return result;
    
  } catch (error) {
    console.error(`❌ SAFE quota update error:`, error);
    throw error;
  }
}

// Enhanced safe status checking with video database storage
async function startSafeStatusChecking(batchId, results) {
  console.log(`\n🔄 STARTING SAFE STATUS CHECKING WITH DB STORAGE: ${batchId}`);
  
  const batch = activeBatches.get(batchId);
  const pendingGeneration = pendingGenerations.get(batchId);
  
  if (!batch || !pendingGeneration) {
    console.log(`❌ No batch or pending generation found for ${batchId}`);
    return;
  }
  
  const maxChecks = 60;
  let checkCount = 0;
  let quotaDeducted = false;
  
  const checkInterval = setInterval(async () => {
    checkCount++;
    console.log(`🔍 SAFE CHECK ${checkCount}/${maxChecks} - Batch: ${batchId}`);
    
    try {
      if (!veo3Generator || !veo3Generator.checkAllVideosStatus) {
        clearInterval(checkInterval);
        cleanupFailedGeneration(batchId, 'VEO3 generator not available');
        return;
      }
      
      const statusUpdate = await veo3Generator.checkAllVideosStatus(results);
      
      // Update batch data
      batch.lastCheck = new Date().toISOString();
      batch.completedVideos = statusUpdate.statusUpdates?.filter(v => v.status === 'completed') || [];
      batch.googleStorageUrls = statusUpdate.googleStorageUrls || [];
      batch.allCompleted = statusUpdate.allCompleted || false;
      batch.summary = statusUpdate.summary || { completed: 0, generating: results.length, failed: 0 };
      
      const completedCount = batch.completedVideos.length;
      const totalRequested = pendingGeneration.videosRequested;
      
      console.log(`📊 Progress: ${completedCount}/${totalRequested} completed`);
      console.log(`📁 Google Storage URLs: ${batch.googleStorageUrls.length}`);
      
      // ENHANCED: Deduct quota AND save videos to database with Google Storage URLs
      if (completedCount > 0 && !quotaDeducted) {
        console.log(`\n💰 DEDUCTING QUOTA & SAVING VIDEOS WITH GOOGLE URLS: ${completedCount} successful videos`);
        
        try {
          // Prepare video data for database storage with enhanced VEO3Generator data
          const videoDataForDatabase = batch.completedVideos.map((video, index) => {
            const promptData = batch.prompts?.[index] || {};
            const localFile = video.localFile || {};
            
            return {
              videoId: video.videoId || `${batchId}_scene_${video.sceneNumber || index + 1}`,
              title: video.title || promptData.title || `Scene ${video.sceneNumber || index + 1}`,
              sceneNumber: video.sceneNumber || index + 1,
              batchId: batchId,
              // IMPORTANT: Save both Google Storage URL and local public URL
              googleStorageUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
              publicUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
              localPath: localFile.localFilePath || '',
              bucketName: localFile.bucketName || '',
              gcsFileName: localFile.gcsFileName || '',
              size: localFile.sizeMB || localFile.size || 0,
              duration: batch.options?.durationSeconds || 8,
              prompt: promptData.prompt || '',
              dialogue: promptData.dialogue || '',
              model: batch.options?.model || 'veo3-fast',
              aspectRatio: batch.options?.aspectRatio || '16:9',
              hasCharacter: promptData.hasCharacter || false,
              hasProduct: promptData.hasProduct || false,
              spokenLanguage: promptData.spokenLanguage || 'en',
              // Enhanced metadata from VEO3Generator
              veo3Data: {
                operationId: video.operationId || '',
                estimatedCost: video.estimatedCost || 1.20,
                downloadedAt: video.downloadedAt || new Date().toISOString(),
                source: localFile.source || 'veo3-gcs'
              }
            };
          });
          
          console.log(`💾 Saving ${videoDataForDatabase.length} videos to database:`);
          videoDataForDatabase.forEach((video, i) => {
            console.log(`   Video ${i + 1}: ${video.title} -> ${video.googleStorageUrl ? 'HAS_GCS_URL' : 'NO_GCS_URL'}`);
          });
          
          await updateUserVideoQuotaSafe(pendingGeneration.userId, completedCount, videoDataForDatabase);
          quotaDeducted = true;
          batch.quotaStatus = 'deducted';
          batch.quotaDeductedCount = completedCount;
          batch.videosSavedToDatabase = true;
          pendingGeneration.status = 'quota_deducted';
          
          console.log(`✅ Quota deducted & videos saved with GCS URLs: ${completedCount} videos for user ${pendingGeneration.userEmail}`);
        } catch (quotaError) {
          console.error(`❌ Quota deduction/video saving failed: ${quotaError.message}`);
        }
      }
      
      // Store completed videos in memory cache with enhanced data
      batch.completedVideos.forEach((video, index) => {
        const localFile = video.localFile || {};
        const googleUrl = localFile.publicUrl || batch.googleStorageUrls[index];
        
        if (googleUrl) {
          completedVideos.set(`${batchId}_scene_${video.sceneNumber}`, {
            batchId,
            userId: batch.userId,
            sceneNumber: video.sceneNumber,
            title: video.title,
            publicUrl: googleUrl,
            googleStorageUrl: googleUrl,
            localPath: localFile.localFilePath,
            bucketName: localFile.bucketName,
            gcsFileName: localFile.gcsFileName,
            size: localFile.sizeMB || localFile.size || 0,
            ready: true,
            veo3Enhanced: true
          });
        }
      });
      
      // Handle completion or timeout
      if (batch.allCompleted || checkCount >= maxChecks) {
        clearInterval(checkInterval);
        
        if (batch.allCompleted) {
          console.log(`🎉 Generation completed for user: ${batch.userEmail}`);
          
          // Final quota reconciliation with enhanced video data
          if (!quotaDeducted && completedCount > 0) {
            console.log(`🔧 Final quota deduction & video saving with GCS URLs: ${completedCount} videos`);
            try {
              const videoDataForDatabase = batch.completedVideos.map((video, index) => {
                const promptData = batch.prompts?.[index] || {};
                const localFile = video.localFile || {};
                
                return {
                  videoId: video.videoId || `${batchId}_scene_${video.sceneNumber || index + 1}`,
                  title: video.title || promptData.title || `Scene ${video.sceneNumber || index + 1}`,
                  sceneNumber: video.sceneNumber || index + 1,
                  batchId: batchId,
                  googleStorageUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
                  publicUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
                  localPath: localFile.localFilePath || '',
                  bucketName: localFile.bucketName || '',
                  gcsFileName: localFile.gcsFileName || '',
                  size: localFile.sizeMB || localFile.size || 0,
                  duration: batch.options?.durationSeconds || 8,
                  prompt: promptData.prompt || '',
                  dialogue: promptData.dialogue || '',
                  model: batch.options?.model || 'veo3-fast',
                  aspectRatio: batch.options?.aspectRatio || '16:9',
                  hasCharacter: promptData.hasCharacter || false,
                  hasProduct: promptData.hasProduct || false,
                  spokenLanguage: promptData.spokenLanguage || 'en',
                  veo3Data: {
                    operationId: video.operationId || '',
                    estimatedCost: video.estimatedCost || 1.20,
                    downloadedAt: video.downloadedAt || new Date().toISOString(),
                    source: localFile.source || 'veo3-gcs'
                  }
                };
              });
              
              await updateUserVideoQuotaSafe(pendingGeneration.userId, completedCount, videoDataForDatabase);
              batch.quotaStatus = 'deducted';
              batch.quotaDeductedCount = completedCount;
              batch.videosSavedToDatabase = true;
            } catch (error) {
              console.error(`❌ Final quota deduction/video saving failed: ${error.message}`);
            }
          }
          
          batch.status = 'completed';
          pendingGeneration.status = 'completed';
        } else {
          console.log(`⏰ Generation timed out for user: ${batch.userEmail}`);
          
          // On timeout, only deduct for completed videos with proper URLs
          if (completedCount > 0 && !quotaDeducted) {
            console.log(`🔧 Timeout quota deduction & video saving: ${completedCount} completed videos`);
            try {
              const videoDataForDatabase = batch.completedVideos.map((video, index) => {
                const promptData = batch.prompts?.[index] || {};
                const localFile = video.localFile || {};
                
                return {
                  videoId: video.videoId || `${batchId}_scene_${video.sceneNumber || index + 1}`,
                  title: video.title || promptData.title || `Scene ${video.sceneNumber || index + 1}`,
                  sceneNumber: video.sceneNumber || index + 1,
                  batchId: batchId,
                  googleStorageUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
                  publicUrl: localFile.publicUrl || batch.googleStorageUrls[index] || '',
                  localPath: localFile.localFilePath || '',
                  bucketName: localFile.bucketName || '',
                  gcsFileName: localFile.gcsFileName || '',
                  size: localFile.sizeMB || localFile.size || 0,
                  duration: batch.options?.durationSeconds || 8,
                  prompt: promptData.prompt || '',
                  dialogue: promptData.dialogue || '',
                  model: batch.options?.model || 'veo3-fast',
                  aspectRatio: batch.options?.aspectRatio || '16:9',
                  hasCharacter: promptData.hasCharacter || false,
                  hasProduct: promptData.hasProduct || false,
                  spokenLanguage: promptData.spokenLanguage || 'en',
                  veo3Data: {
                    operationId: video.operationId || '',
                    estimatedCost: video.estimatedCost || 1.20,
                    downloadedAt: video.downloadedAt || new Date().toISOString(),
                    source: localFile.source || 'veo3-gcs-timeout'
                  }
                };
              });
              
              await updateUserVideoQuotaSafe(pendingGeneration.userId, completedCount, videoDataForDatabase);
              batch.quotaStatus = 'partial_deducted';
              batch.quotaDeductedCount = completedCount;
              batch.videosSavedToDatabase = true;
            } catch (error) {
              console.error(`❌ Timeout quota deduction/video saving failed: ${error.message}`);
            }
          }
          
          batch.status = 'timeout';
          pendingGeneration.status = 'timeout';
        }
        
        activeBatches.set(batchId, batch);
        pendingGenerations.set(batchId, pendingGeneration);
      }
      
    } catch (error) {
      console.error(`❌ Safe status check error: ${error.message}`);
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        cleanupFailedGeneration(batchId, error.message);
      }
    }
    
  }, 30000);
}

// Clean up failed generations without quota deduction
function cleanupFailedGeneration(batchId, reason) {
  console.log(`\n🧹 CLEANING UP FAILED GENERATION: ${batchId}`);
  console.log(`📝 Reason: ${reason}`);
  
  const batch = activeBatches.get(batchId);
  const pendingGeneration = pendingGenerations.get(batchId);
  
  if (batch) {
    batch.status = 'failed';
    batch.error = reason;
    batch.quotaStatus = 'not_deducted';
    activeBatches.set(batchId, batch);
  }
  
  if (pendingGeneration) {
    pendingGeneration.status = 'failed';
    pendingGeneration.error = reason;
    pendingGenerations.set(batchId, pendingGeneration);
    
    console.log(`✅ No quota deducted for failed generation (user: ${pendingGeneration.userEmail})`);
  }
}

// FIXED: Add middleware to check OpenAI setup for images
const checkOpenAISetup = (req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return res.status(500).json({
      success: false,
      error: 'OpenAI not configured',
      message: 'GPT-Image-1 service is not properly configured'
    });
  }
  
  if (!openai) {
    console.error('❌ OpenAI client not initialized');
    return res.status(500).json({
      success: false,
      error: 'OpenAI client error',
      message: 'GPT-Image-1 service is not available'
    });
  }
  
  next();
};

// ENHANCED Helper function for image download (supports base64 data URLs)
async function downloadAndSaveImage(imageUrl, imageId) {
  try {
    console.log(`📥 Downloading image from: ${imageUrl.substring(0, 100)}...`);
    
    let buffer;
    
    // Check if it's a base64 data URL
    if (imageUrl.startsWith('data:image/')) {
      console.log('🔄 Processing base64 data URL...');
      const base64Data = imageUrl.split(',')[1]; // Remove "data:image/png;base64," prefix
      buffer = Buffer.from(base64Data, 'base64');
      console.log(`📊 Base64 decoded size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    } else {
      // Regular HTTP download
      console.log('🌐 Downloading from HTTP URL...');
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,  // 30 second timeout
        headers: {
          'User-Agent': 'MagicCut-AI/1.0'
        }
      });
      
      buffer = Buffer.from(response.data);
    }
    
    const fileName = `${imageId}.png`;
    
    // Ensure generated images directory exists
    const generatedDir = './generated/images';
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
      console.log(`📁 Created directory: ${generatedDir}`);
    }
    
    const filePath = path.join(generatedDir, fileName);
    fs.writeFileSync(filePath, buffer);
    
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`💾 Image saved: ${filePath} (${fileSizeMB}MB)`);
    
    return filePath;
    
  } catch (error) {
    console.error('❌ Error downloading image:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Download timeout - image too large or connection too slow');
    } else if (error.response && error.response.status === 404) {
      throw new Error('Generated image not found - OpenAI URL may have expired');
    } else if (error.response && error.response.status >= 400) {
      throw new Error(`Failed to download image: HTTP ${error.response.status}`);
    }
    
    throw new Error('Failed to save generated image');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🎨 GPT-IMAGE-1 MULTI-IMAGE GENERATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════════════

// GPT-Image-1 Multi-Image Generation Route
app.post('/api/generate-image', requireAuth, checkImageCredits, checkOpenAISetup, imageUpload.array('images', 10), async (req, res) => {
  console.log('\n🎨 GPT-IMAGE-1 GENERATION REQUEST');
  console.log('═══════════════════════════════════════════');
  
  try {
    const { 
      prompt, 
      mode = 'edit',
      quality = 'medium', 
      size = '1024x1024',
      output_format = 'png',
      output_compression = 85
    } = req.body;
    
    const uploadedFiles = req.files || [];
    
    console.log(`👤 User: ${req.user.email}`);
    console.log(`📝 Prompt: ${prompt}`);
    console.log(`🖼️ Uploaded files: ${uploadedFiles.length}`);
    console.log(`🎭 Mode: ${mode}`);
    console.log(`🎨 Quality: ${quality}`);
    console.log(`📏 Size: ${size}`);
    console.log(`📁 Format: ${output_format}`);
    
    // Validation
    if (mode !== 'generate' && uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No images uploaded',
        message: 'Please upload at least one image for editing/variation mode'
      });
    }
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No prompt provided',
        message: 'Please describe what you want to create'
      });
    }
    
    // Check credits
    if (req.user.credits.available < 1) {
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You need at least 1 credit to generate an image'
      });
    }
    
    console.log('💳 Credits check passed. Starting GPT-Image-1 generation...');
    
    let generatedImageUrl;
    let apiMethod;
    
    try {
      if (mode === 'generate') {
        // Pure text-to-image generation
        console.log('✨ Calling GPT-Image-1 generation...');
        apiMethod = 'generate';
        
        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt: prompt.trim(),
          size: size,
          quality: quality,
          output_format: output_format,
          output_compression: parseInt(output_compression),
          n: 1
        });
        
        generatedImageUrl = response.data[0].url;
        
      } else {
        // Image editing/variation with GPT-Image-1 using direct HTTP with FormData
        console.log(`🔄 Calling GPT-Image-1 ${mode} with ${uploadedFiles.length} images via direct HTTP...`);
        apiMethod = 'edit';
        
        // Process all images with Sharp first
        const processedBuffers = [];
        
        for (let i = 0; i < uploadedFiles.length; i++) {
          const file = uploadedFiles[i];
          if (!fs.existsSync(file.path)) {
            throw new Error(`File not found: ${file.path}`);
          }
          
          // Process image with Sharp to ensure PNG format
          const buffer = await sharp(file.path)
            .resize(1024, 1024, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .png()
            .toBuffer();
          
          processedBuffers.push(buffer);
          console.log(`📷 Processed image ${i+1}: ${file.originalname} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        }
        
        // Create FormData for GPT-Image-1 API
        const form = new FormData();
        
        // Add images with explicit PNG content type and proper array syntax
        if (uploadedFiles.length === 1) {
          // Single image
          form.append('image', processedBuffers[0], {
            filename: 'image.png',
            contentType: 'image/png'
          });
        } else {
          // Multiple images - use array syntax image[] for each image
          processedBuffers.forEach((buffer, index) => {
            form.append('image[]', buffer, {
              filename: `image${index}.png`,
              contentType: 'image/png'
            });
          });
        }
        
        // Add other parameters for GPT-Image-1
        form.append('model', 'gpt-image-1');
        form.append('prompt', prompt.trim());
        form.append('n', '1');
        form.append('size', size);
        form.append('quality', quality);
        form.append('output_format', output_format);
        
        // Only add compression for JPEG and WebP, not for PNG
        if (output_format && (output_format.toLowerCase() === 'jpeg' || output_format.toLowerCase() === 'webp')) {
          console.log(`📏 Adding compression parameter: ${output_compression}`);
          form.append('output_compression', output_compression.toString());
        } else {
          console.log(`🚫 Skipping compression for PNG format`);
        }
        
        console.log('📡 Sending FormData to GPT-Image-1 API...');
        
        // Make direct HTTP request to GPT-Image-1 edits endpoint
        const formHeaders = form.getHeaders();
        const response = await axios.post('https://api.openai.com/v1/images/edits', form, {
          headers: {
            ...formHeaders,
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'User-Agent': 'MagicCut-AI/1.0'
          },
          timeout: 120000 // 2 minute timeout for multi-image processing
        });
        
        // Try different possible response structures for GPT-Image-1
        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].url) {
          generatedImageUrl = response.data.data[0].url;
          console.log('📍 Found URL at: response.data.data[0].url');
        } else if (response.data && response.data[0] && response.data[0].url) {
          generatedImageUrl = response.data[0].url;
          console.log('📍 Found URL at: response.data[0].url');
        } else if (response.data && response.data.url) {
          generatedImageUrl = response.data.url;
          console.log('📍 Found URL at: response.data.url');
        } else if (response.data && response.data.image_url) {
          generatedImageUrl = response.data.image_url;
          console.log('📍 Found URL at: response.data.image_url');
        } else if (response.data && response.data.images && response.data.images[0] && response.data.images[0].url) {
          generatedImageUrl = response.data.images[0].url;
          console.log('📍 Found URL at: response.data.images[0].url');
        } else if (response.data && response.data.output && response.data.output.url) {
          generatedImageUrl = response.data.output.url;
          console.log('📍 Found URL at: response.data.output.url');
        } else if (response.data && response.data.result && response.data.result.url) {
          generatedImageUrl = response.data.result.url;
          console.log('📍 Found URL at: response.data.result.url');
        } else {
          // Check for base64 data as fallback
          if (response.data && response.data.data && response.data.data[0] && response.data.data[0].b64_json) {
            console.log('📍 Found base64 data at: response.data.data[0].b64_json');
            const base64Data = response.data.data[0].b64_json;
            generatedImageUrl = `data:image/png;base64,${base64Data}`;
            console.log('🔄 Converted base64 to data URL');
          } else if (response.data && response.data.b64_json) {
            console.log('📍 Found base64 data at: response.data.b64_json');
            const base64Data = response.data.b64_json;
            generatedImageUrl = `data:image/png;base64,${base64Data}`;
            console.log('🔄 Converted base64 to data URL');
          } else {
            console.error('❌ Could not find image URL or base64 data in response structure');
            console.error('📋 Available fields:', Object.keys(response.data || {}));
            throw new Error('Generated image URL not found in response');
          }
        }
      }
      
      console.log(`✅ GPT-Image-1 API success: ${generatedImageUrl}`);
      
    } catch (openaiError) {
      console.error('❌ GPT-Image-1 API Error:', openaiError);
      
      let errorMessage = 'GPT-Image-1 service error. Please try again.';
      let statusCode = 500;
      
      if (openaiError.response?.status === 400) {
        const errorData = openaiError.response.data?.error;
        if (errorData?.message) {
          console.error('🔍 Specific GPT-Image-1 error:', errorData.message);
          errorMessage = `GPT-Image-1 API error: ${errorData.message}`;
        }
        statusCode = 400;
      } else if (openaiError.response?.status === 429) {
        errorMessage = 'GPT-Image-1 API rate limit reached. Please try again later.';
        statusCode = 429;
      } else if (openaiError.response?.status === 402) {
        errorMessage = 'OpenAI API credits exhausted. Please contact support.';
        statusCode = 402;
      }
      
      // Clean up uploaded files
      uploadedFiles.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.log(`⚠️ Could not delete upload: ${file.path}`);
        }
      });
      
      return res.status(statusCode).json({
        success: false,
        error: 'Image generation failed',
        message: errorMessage,
        details: openaiError.response?.data?.error?.message || openaiError.message
      });
    }
    
    // Download and save generated image
    const imageId = `gpt_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let savedImagePath;
    
    try {
      savedImagePath = await downloadAndSaveImage(generatedImageUrl, imageId);
      console.log(`💾 Image saved successfully: ${savedImagePath}`);
    } catch (downloadError) {
      console.error('❌ Failed to save generated image:', downloadError);
      throw new Error('Failed to save generated image');
    }
    
    // Prepare image entry for database
    const imageEntry = {
      imageId,
      originalPrompt: prompt.trim(),
      editPrompt: prompt.trim(),
      originalImageUrls: uploadedFiles.map(file => `/uploads/images/${file.filename}`),
      generatedImageUrl: `/generated/images/${path.basename(savedImagePath)}`,
      localPath: savedImagePath,
      size: fs.existsSync(savedImagePath) ? fs.statSync(savedImagePath).size : 0,
      creditsUsed: 1,
      createdAt: new Date(),
      metadata: {
        model: 'gpt-image-1',
        quality: quality,
        size: size,
        mode: mode,
        outputFormat: output_format,
        outputCompression: output_compression,
        apiMethod: apiMethod,
        inputImages: uploadedFiles.length,
        originalFiles: uploadedFiles.map(file => ({
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }))
      }
    };
    
    // Update user credits and save image
    console.log('💰 Deducting credits and saving to database...');
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: { 
          'credits.available': -1,
          'credits.used': 1
        },
        $push: { generatedImages: imageEntry },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (!updatedUser) {
      throw new Error('Failed to update user credits');
    }
    
    console.log('✅ Image saved and credits deducted');
    console.log(`💳 Credits remaining: ${updatedUser.credits.available}`);
    
    // Clean up uploaded files after successful processing
    uploadedFiles.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Cleaned up: ${file.path}`);
        }
      } catch (err) {
        console.log(`⚠️ Could not delete temp file: ${file.path}`);
      }
    });
    
    // Send successful response
    res.json({
      success: true,
      image: imageEntry,
      credits: {
        available: updatedUser.credits.available,
        used: updatedUser.credits.used,
        totalPurchased: updatedUser.credits.totalPurchased
      },
      message: 'Image generated successfully with GPT-Image-1!',
      processing: {
        model: 'gpt-image-1',
        method: apiMethod,
        filesProcessed: uploadedFiles.length,
        quality: quality,
        size: size,
        format: output_format
      }
    });
    
  } catch (error) {
    console.error('❌ GPT-Image-1 generation error:', error);
    
    // Clean up uploaded files on any error
    if (req.files) {
      req.files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (err) {
          console.log(`⚠️ Could not delete file during error cleanup: ${file.path}`);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Image generation failed',
      message: 'An unexpected error occurred. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced Credit Packages Configuration
const CREDIT_PACKAGES = {
  small: {
    id: 'small',
    name: 'Small Package',
    credits: 25,
    price: 25.00,
    priceInCents: 2500,
    currency: 'eur',
    description: '25 AI Image Generations',
    features: [
      '25 AI image generations',
      'GPT-Image-1 model access',
      'Multi-image support (up to 10 images)',
      'All quality settings',
      'Credits never expire'
    ]
  },
  medium: {
    id: 'medium',
    name: 'Medium Package',
    credits: 50,
    price: 50.00,
    priceInCents: 5000,
    currency: 'eur',
    popular: true,
    description: '50 AI Image Generations',
    features: [
      '50 AI image generations',
      'GPT-Image-1 model access',
      'Multi-image composition',
      'Priority processing queue',
      'Credits never expire'
    ]
  },
  large: {
    id: 'large',
    name: 'Large Package',
    credits: 150,
    price: 150.00,
    priceInCents: 15000,
    currency: 'eur',
    description: '150 AI Image Generations',
    features: [
      '150 AI image generations',
      'GPT-Image-1 model access',
      'Multi-image composition',
      'All output formats',
      'Email support included',
      'Credits never expire'
    ]
  }
};

// Get available credit packages
app.get('/api/image-credits/packages', (req, res) => {
  console.log('📦 Getting credit packages');
  
  res.json({
    success: true,
    packages: CREDIT_PACKAGES
  });
});

// Purchase credits (create Stripe session)
app.post('/api/image-credits/purchase', requireAuth, async (req, res) => {
  console.log('\n💳 CREDIT PURCHASE REQUEST');
  console.log('═══════════════════════════════════');
  
  try {
    const { packageId } = req.body;
    
    console.log(`👤 User: ${req.user.email}`);
    console.log(`📦 Package: ${packageId}`);
    
    if (!packageId || !CREDIT_PACKAGES[packageId]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package selected',
        availablePackages: Object.keys(CREDIT_PACKAGES)
      });
    }
    
    const package = CREDIT_PACKAGES[packageId];
    console.log(`💰 Package details: ${package.name} - €${package.price} - ${package.credits} credits`);
    
    // Get user data
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log(`💳 Current user credits: ${user.credits?.available || 0}`);
    
    // Check if stripe is configured
    if (!stripe) {
      console.error('❌ Stripe not configured');
      return res.status(500).json({
        success: false,
        error: 'Payment system not configured'
      });
    }
    
    // Create Stripe Checkout Session
    console.log('🔗 Creating Stripe checkout session...');
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'ideal'],
      line_items: [{
        price_data: {
          currency: package.currency,
          product_data: {
            name: `MagicCut AI - ${package.name}`,
            description: package.description,
          },
          unit_amount: package.priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin || 'http://localhost:3000'}/image-credits?success=true&session_id={CHECKOUT_SESSION_ID}&package=${packageId}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/image-credits?canceled=true`,
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        packageId: packageId,
        credits: package.credits.toString(),
        userEmail: user.email,
        type: 'image_credits',
        packageName: package.name,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`✅ Stripe session created: ${session.id}`);
    console.log(`🔗 Checkout URL: ${session.url}`);
    
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      package: package,
      message: `Redirecting to checkout for ${package.name}`,
      stripeSessionId: session.id
    });
    
  } catch (error) {
    console.error('❌ Purchase credits error:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        success: false,
        error: 'Payment failed',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create payment session',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again'
    });
  }
});

// Verify payment and add credits
app.post('/api/image-credits/verify-payment', requireAuth, async (req, res) => {
  console.log('\n🔍 PAYMENT VERIFICATION');
  console.log('═══════════════════════════════════');
  
  try {
    const { sessionId, packageId } = req.body;
    
    console.log(`👤 User: ${req.user.email}`);
    console.log(`🔍 Session ID: ${sessionId}`);
    console.log(`📦 Package ID: ${packageId}`);
    
    if (!sessionId || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'Missing session ID or package ID'
      });
    }
    
    const package = CREDIT_PACKAGES[packageId];
    if (!package) {
      return res.status(400).json({
        success: false,
        error: 'Invalid package'
      });
    }
    
    console.log(`💰 Package: ${package.name} - ${package.credits} credits`);
    
    // Retrieve the session from Stripe
    console.log('🔍 Retrieving Stripe session...');
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log(`💳 Payment status: ${session.payment_status}`);
    console.log(`💰 Amount paid: €${session.amount_total / 100}`);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
        paymentStatus: session.payment_status
      });
    }
    
    // Verify the payment amount and package
    if (session.amount_total !== package.priceInCents) {
      console.error(`❌ Amount mismatch: paid ${session.amount_total}, expected ${package.priceInCents}`);
      return res.status(400).json({
        success: false,
        error: 'Payment amount mismatch'
      });
    }
    
    // Check if we already processed this session
    const User = mongoose.model('User');
    const existingPurchase = await User.findOne({
      'credits.packages.stripeSessionId': sessionId
    });
    
    if (existingPurchase) {
      console.log('⚠️ Payment already processed');
      return res.status(400).json({
        success: false,
        error: 'Payment already processed'
      });
    }
    
    // Add credits to user account
    console.log(`💰 Adding ${package.credits} credits to user account...`);
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $inc: {
          'credits.available': package.credits,
          'credits.totalPurchased': package.credits
        },
        $set: {
          'credits.lastPurchase': new Date(),
          'updatedAt': new Date()
        },
        $push: {
          'credits.packages': {
            amount: package.price,
            credits: package.credits,
            purchaseDate: new Date(),
            stripeSessionId: sessionId,
            packageId: packageId,
            packageName: package.name
          }
        }
      },
      { new: true }
    );
    
    if (!updatedUser) {
      throw new Error('Failed to update user credits');
    }
    
    console.log('✅ Credits successfully added to user account');
    console.log(`💳 New credit balance: ${updatedUser.credits.available}`);
    
    res.json({
      success: true,
      message: `Successfully added ${package.credits} credits to your account!`,
      credits: {
        available: updatedUser.credits.available,
        used: updatedUser.credits.used,
        totalPurchased: updatedUser.credits.totalPurchased,
        justPurchased: package.credits
      },
      package: {
        name: package.name,
        credits: package.credits,
        price: package.price
      },
      purchase: {
        sessionId: sessionId,
        date: new Date().toISOString(),
        amount: package.price
      }
    });
    
  } catch (error) {
    console.error('❌ Verify payment error:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment session',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please contact support'
    });
  }
});

// Get user credit status
app.get('/api/image-credits/status', requireAuth, async (req, res) => {
  try {
    console.log(`💳 Getting credit status for user: ${req.user.email}`);
    
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id)
      .select('credits generatedImages email firstName lastName')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const creditInfo = {
      available: user.credits?.available || 0,
      used: user.credits?.used || 0,
      totalPurchased: user.credits?.totalPurchased || 0,
      lastPurchase: user.credits?.lastPurchase,
      totalImages: user.generatedImages?.length || 0,
      packages: user.credits?.packages || []
    };
    
    console.log(`📊 Credit status: ${creditInfo.available} available, ${creditInfo.used} used`);
    
    res.json({
      success: true,
      user: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      },
      credits: creditInfo,
      canGenerate: creditInfo.available > 0,
      packagesAvailable: CREDIT_PACKAGES,
      stats: {
        totalImages: creditInfo.totalImages,
        creditsPerImage: creditInfo.totalImages > 0 ? (creditInfo.used / creditInfo.totalImages).toFixed(2) : 0,
        remainingValue: (creditInfo.available * 1.00).toFixed(2) // €1 per credit
      }
    });
    
  } catch (error) {
    console.error('❌ Credit status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get credit status',
      details: error.message
    });
  }
});

// Get user's image gallery
app.get('/api/image-gallery', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const user = await User.findById(req.user.id)
      .select('generatedImages credits')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Sort images by creation date (newest first)
    const images = user.generatedImages?.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    ) || [];
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedImages = images.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      images: paginatedImages,
      pagination: {
        currentPage: parseInt(page),
        totalImages: images.length,
        totalPages: Math.ceil(images.length / limit),
        hasNext: endIndex < images.length,
        hasPrev: page > 1
      },
      credits: user.credits,
      stats: {
        totalImages: images.length,
        totalCreditsUsed: images.reduce((sum, img) => sum + (img.creditsUsed || 1), 0),
        editTypes: [...new Set(images.map(img => img.metadata?.editType).filter(Boolean))]
      }
    });
    
  } catch (error) {
    console.error('❌ Gallery fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery',
      details: error.message
    });
  }
});

// Delete image from gallery
app.delete('/api/image-gallery/:imageId', requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;
    
    const user = await User.findById(req.user.id);
    const imageIndex = user.generatedImages.findIndex(img => img.imageId === imageId);
    
    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }
    
    const image = user.generatedImages[imageIndex];
    
    // Delete physical file
    if (image.localPath && fs.existsSync(image.localPath)) {
      fs.unlinkSync(image.localPath);
    }
    
    // Remove from database
    user.generatedImages.splice(imageIndex, 1);
    await user.save();
    
    res.json({
      success: true,
      message: 'Image deleted successfully',
      imageId
    });
    
  } catch (error) {
    console.error('❌ Delete image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🎬 VEO3 VIDEO GENERATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════════════

// Auth endpoint with enhanced user data including videos
app.get('/api/auth/me', customAuth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const freshUser = await User.findById(req.user.id)
      .select('firstName lastName email subscription usage hasActiveSubscription createdAt generatedVideos generatedImages credits')
      .lean();
    
    if (!freshUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('\n🔍 SAFE QUOTA DEBUG - /api/auth/me');
    console.log('═══════════════════════════════════════');
    console.log(`👤 User: ${freshUser.email}`);

    const subscription = freshUser.subscription || {};
    const usage = freshUser.usage || {};
    
    let hasActiveSubscription = false;
    
    if (freshUser.hasActiveSubscription === true) {
      hasActiveSubscription = true;
    } else if (checkActiveSubscription(subscription)) {
      hasActiveSubscription = true;
    } else if (usage.monthlyLimit && usage.monthlyLimit > 1) {
      hasActiveSubscription = true;
    }
    
    const planDetection = detectUserPlan(subscription, usage);
    let monthlyLimit = planDetection.limit;
    let planSource = planDetection.source;
    
    const videosUsed = usage.videosGenerated || 0;
    const videosRemaining = Math.max(0, monthlyLimit - videosUsed);

    console.log(`🎯 Plan Detection: ${planSource}`);
    console.log(`📈 Monthly Limit: ${monthlyLimit}`);
    console.log(`📹 Videos Used: ${videosUsed}`);
    console.log(`⏳ Videos Remaining: ${videosRemaining}`);
    console.log(`💾 Videos in Database: ${freshUser.generatedVideos?.length || 0}`);
    console.log(`🖼️ Images in Database: ${freshUser.generatedImages?.length || 0}`);
    console.log(`💳 Image Credits: ${freshUser.credits?.available || 0}`);
    console.log(`✅ Has Active Subscription: ${hasActiveSubscription}`);
    console.log('═══════════════════════════════════════\n');

    const userData = {
      ...freshUser,
      hasActiveSubscription: hasActiveSubscription,
      usage: {
        ...usage,
        monthlyLimit: monthlyLimit,
        videosGenerated: videosUsed,
        remaining: videosRemaining
      },
      videoLibrary: {
        totalVideos: freshUser.generatedVideos?.length || 0,
        videos: freshUser.generatedVideos || []
      },
      imageLibrary: {
        totalImages: freshUser.generatedImages?.length || 0,
        images: freshUser.generatedImages || []
      },
      credits: freshUser.credits || { available: 0, used: 0, totalPurchased: 0 }
    };

    res.json({
      success: true,
      user: userData,
      debug: {
        planDetection: planSource,
        calculatedLimit: monthlyLimit,
        hasActiveSubscription: hasActiveSubscription,
        safeQuotaSystem: true,
        freshFromDatabase: true,
        videosInDatabase: freshUser.generatedVideos?.length || 0,
        imagesInDatabase: freshUser.generatedImages?.length || 0,
        imageCredits: freshUser.credits?.available || 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      details: error.message
    });
  }
});

// 1. Character Analysis
app.post('/api/analyze-character', customAuth, videoUpload.single('characterImage'), async (req, res) => {
  try {
    if (!characterAnalyzer) {
      return res.status(503).json({ error: 'Character analyzer not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No character image uploaded' });
    }

    console.log(`🎭 Analyzing character for user: ${req.user.email}`);
    const result = await characterAnalyzer.analyzeImage(req.file.path);
    
    res.json({
      success: true,
      templateId: result.templateId,
      character: result.characterTemplate.template.character,
      analysisMethod: result.analysisMethod,
      metadata: result.characterTemplate.metadata
    });

  } catch (error) {
    console.error('Character analysis error:', error);
    res.status(500).json({ error: 'Character analysis failed', details: error.message });
  }
});

// 2. Product Analysis
app.post('/api/analyze-product', customAuth, videoUpload.single('productImage'), async (req, res) => {
  try {
    if (!productAnalyzer) {
      return res.status(503).json({ error: 'Product analyzer not available' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No product image uploaded' });
    }

    const { productDescription } = req.body;
    console.log(`📦 Analyzing product for user: ${req.user.email}`);
    
    const description = productDescription || productAnalyzer.generateDescriptionFromFilename(
      path.basename(req.file.filename, path.extname(req.file.filename))
    );

    const result = await productAnalyzer.analyzeProductWithImage(req.file.path, description, {});
    
    res.json({
      success: true,
      templateId: result.templateId,
      product: result.productTemplate.template.product,
      analysisMethod: result.analysisMethod,
      sourceImage: result.sourceImage,
      metadata: result.productTemplate.metadata
    });

  } catch (error) {
    console.error('Product analysis error:', error);
    res.status(500).json({ error: 'Product analysis failed', details: error.message });
  }
});

// 3. Generate prompts
app.post('/api/generate-prompts', customAuth, async (req, res) => {
  try {
    const { characterTemplateId, productTemplateId, scenes, spokenLanguage = 'en', sceneDuration = 8 } = req.body;

    if (!scenes || scenes.length === 0) {
      return res.status(400).json({ error: 'No scenes provided' });
    }

    console.log(`📝 Generating prompts for user: ${req.user.email}`);

    const prompts = await generateEnhancedPrompts({
      characterTemplateId,
      productTemplateId,
      scenes,
      spokenLanguage,
      sceneDuration,
      characterAnalyzer,
      productAnalyzer
    });
    
    res.json({
      success: true,
      promptSetId: prompts.promptSetId,
      prompts: prompts.prompts,
      metadata: prompts.metadata
    });

  } catch (error) {
    console.error('Prompt generation error:', error);
    res.status(500).json({ error: 'Prompt generation failed', details: error.message });
  }
});

// 4. VEO3 video generation endpoint
app.post('/api/generate-veo3-videos', customAuth, ourQuotaCheck, async (req, res) => {
  console.log(`\n🎬 SAFE VEO3 GENERATION WITH DATABASE STORAGE`);
  console.log('═══════════════════════════════════════════════════');
  
  try {
    if (!veo3Generator) {
      return res.status(503).json({ error: 'VEO3 generator not available' });
    }

    const { prompts, options = {} } = req.body;
    
    if (!prompts || prompts.length === 0) {
      return res.status(400).json({ error: 'No prompts provided' });
    }
    
    console.log(`👤 User: ${req.user.email}`);
    console.log(`📊 Current Quota: ${req.userQuota?.used || 0}/${req.userQuota?.limit || 0} used`);
    console.log(`🎯 Videos to generate: ${prompts.length}`);
    console.log(`💰 Cost estimate: $${(prompts.length * 1.20).toFixed(2)}`);
    console.log(`🔍 Plan detection: ${req.userQuota?.planDetection || 'unknown'}`);
    
    const videosToGenerate = prompts.length;
    const videosRemaining = req.userQuota?.remaining || 0;
    
    if (videosToGenerate > videosRemaining) {
      return res.status(429).json({
        error: 'Not enough videos remaining',
        message: `You want to generate ${videosToGenerate} videos but only have ${videosRemaining} remaining.`,
        usage: {
          requested: videosToGenerate,
          remaining: videosRemaining,
          used: req.userQuota?.used || 0,
          limit: req.userQuota?.limit || 0
        },
        suggestion: 'Reduce the number of scenes or upgrade your plan'
      });
    }
    
    const safeOptions = {
      durationSeconds: Math.min(Math.max(parseInt(options.durationSeconds) || 8, 1), 60),
      generateAudio: options.generateAudio !== false,
      aspectRatio: options.aspectRatio || '16:9',
      model: options.model || 'fast',
      modelName: options.modelName || (options.model === 'normal' ? 'veo-3.0-generate-preview' : 'veo-3.0-fast-generate-preview')
    };
    
    console.log(`🚀 Starting VEO3 generation (videos will be saved to database on success)...`);
    
    let result;
    try {
      result = await veo3Generator.generateVideos(prompts, safeOptions);
    } catch (generationError) {
      console.error(`❌ VEO3 generation error:`, generationError);
      console.log(`✅ No quota deducted due to generation failure`);
      
      if (generationError.message && generationError.message.includes('remaining')) {
        return res.status(400).json({ 
          error: 'VEO3 API usage verification failed', 
          details: 'Google Cloud Vertex AI usage check failed.',
          userQuota: req.userQuota,
          quotaDeducted: false
        });
      }
      
      throw generationError;
    }
    
    if (!result || !result.batchId) {
      console.log(`❌ Invalid VEO3 response - no quota deducted`);
      throw new Error('Invalid response from VEO3 generator');
    }
    
    console.log(`✅ VEO3 generation started: ${result.batchId}`);
    console.log(`⏳ Videos will be saved to database when they complete successfully`);
    
    pendingGenerations.set(result.batchId, {
      userId: req.user.id,
      userEmail: req.user.email,
      videosRequested: videosToGenerate,
      startTime: new Date().toISOString(),
      quotaBefore: req.userQuota,
      status: 'pending'
    });
    
    const batchData = {
      ...result,
      userId: req.user.id,
      userEmail: req.user.email,
      startTime: new Date().toISOString(),
      status: 'generating',
      lastCheck: null,
      completedVideos: [],
      googleStorageUrls: [],
      prompts: prompts,
      options: safeOptions,
      quotaStatus: 'pending',
      videosSavedToDatabase: false,
      businessInfo: {
        videosRequested: videosToGenerate,
        quotaBefore: req.userQuota,
        plan: req.user.subscription?.plan || 'unknown'
      }
    };
    
    activeBatches.set(result.batchId, batchData);
    
    if (result.results && result.results.length > 0) {
      console.log(`🔄 Starting safe status checking with database storage...`);
      startSafeStatusChecking(result.batchId, result.results);
    }
    
    const response = {
      success: true,
      batchId: result.batchId,
      results: result.results,
      totalVideos: result.totalVideos || prompts.length,
      estimatedCost: result.estimatedCost,
      status: result.status || 'generating',
      autoChecking: true,
      message: 'Video generation started - videos will be saved to your library on completion',
      userUsage: {
        current: req.userQuota?.used || 0,
        limit: req.userQuota?.limit || 0,
        remaining: req.userQuota?.remaining || 0,
        plan: req.user.subscription?.plan || 'unknown',
        pending: videosToGenerate
      },
      quotaStatus: 'pending',
      quotaDebug: {
        planDetection: req.userQuota?.planDetection,
        quotaBefore: req.userQuota,
        safeQuotaSystem: true,
        deductOnSuccess: true,
        saveToDatabase: true
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`📡 Response: ${response.totalVideos} videos started for ${req.user.email} (will save to database)`);
    res.json(response);

  } catch (error) {
    console.error(`❌ VEO3 GENERATION FAILED: ${error.message}`);
    console.log(`✅ No quota deducted or videos saved due to failure`);
    
    res.status(500).json({ 
      error: 'VEO3 generation failed', 
      details: error.message,
      userQuota: req.userQuota,
      quotaDeducted: false,
      timestamp: new Date().toISOString()
    });
  }
});

// 5. Enhanced Batch Status with Google Storage URLs
app.get('/api/batch-status/:batchId', customAuth, async (req, res) => {
  const { batchId } = req.params;
  
  try {
    const batch = activeBatches.get(batchId);
    const pendingGeneration = pendingGenerations.get(batchId);
    
    if (!batch) {
      return res.status(404).json({ 
        success: false,
        error: 'Batch not found',
        batchId
      });
    }
    
    if (batch.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not your batch',
        batchId
      });
    }
    
    const cachedStatus = batchStatusCache.get(batchId);
    const now = Date.now();
    
    if (cachedStatus && (now - cachedStatus.timestamp) < 30000) {
      return res.json(cachedStatus.data);
    }
    
    // Enhanced video data with Google Storage URLs
    const batchVideos = Array.from(completedVideos.values())
      .filter(v => v.batchId === batchId && v.userId === req.user.id)
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
      .map(video => ({
        ...video,
        // Ensure we have both local and Google Storage URLs
        googleStorageUrl: video.googleStorageUrl || video.publicUrl,
        veo3Enhanced: video.veo3Enhanced || false
      }));
    
    const response = {
      success: true,
      batchId,
      status: batch.status || 'generating',
      totalVideos: batch.totalVideos || batch.results?.length || 1,
      completedCount: batch.completedVideos?.length || 0,
      summary: batch.summary || {
        completed: batch.completedVideos?.length || 0,
        generating: (batch.totalVideos || 1) - (batch.completedVideos?.length || 0),
        failed: 0
      },
      allCompleted: batch.allCompleted || false,
      videos: batchVideos,
      googleStorageUrls: batch.googleStorageUrls || [],
      readyForCreatomate: (batch.googleStorageUrls || []).length >= 2,
      lastChecked: batch.lastCheck || new Date().toISOString(),
      estimatedCost: batch.estimatedCost,
      autoChecking: true,
      businessInfo: batch.businessInfo,
      // Enhanced quota and VEO3 info
      quotaStatus: batch.quotaStatus || 'pending',
      quotaDeductedCount: batch.quotaDeductedCount || 0,
      videosSavedToDatabase: batch.videosSavedToDatabase || false,
      pendingGeneration: pendingGeneration ? {
        videosRequested: pendingGeneration.videosRequested,
        status: pendingGeneration.status,
        startTime: pendingGeneration.startTime
      } : null,
      veo3Enhanced: true,
      safeQuotaSystem: true
    };
    
    batchStatusCache.set(batchId, {
      data: response,
      timestamp: now
    });
    
    res.json(response);
    
  } catch (error) {
    console.error(`❌ Batch status check failed: ${error.message}`);
    res.status(500).json({ 
      success: false,
      error: 'Status check failed', 
      details: error.message,
      batchId
    });
  }
});

// 6. Get user's video library
app.get('/api/videos/library', customAuth, async (req, res) => {
  try {
    const User = mongoose.model('User');
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const user = await User.findById(req.user.id)
      .select('generatedVideos')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const videos = user.generatedVideos || [];
    
    // Sort videos
    const sortOrder = order === 'desc' ? -1 : 1;
    videos.sort((a, b) => {
      if (sortBy === 'createdAt') {
        return (new Date(b.createdAt) - new Date(a.createdAt)) * sortOrder;
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title) * sortOrder;
      } else if (sortBy === 'size') {
        return (a.size - b.size) * sortOrder;
      }
      return 0;
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    // Group by batch for better organization
    const batchGroups = {};
    paginatedVideos.forEach(video => {
      if (!batchGroups[video.batchId]) {
        batchGroups[video.batchId] = [];
      }
      batchGroups[video.batchId].push(video);
    });
    
    res.json({
      success: true,
      videos: paginatedVideos,
      batchGroups: batchGroups,
      pagination: {
        currentPage: parseInt(page),
        totalVideos: videos.length,
        totalPages: Math.ceil(videos.length / limit),
        hasNext: endIndex < videos.length,
        hasPrev: page > 1
      },
      stats: {
        totalVideos: videos.length,
        totalSize: videos.reduce((sum, video) => sum + (video.size || 0), 0),
        languages: [...new Set(videos.map(v => v.metadata?.spokenLanguage).filter(Boolean))],
        models: [...new Set(videos.map(v => v.metadata?.model).filter(Boolean))]
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching video library:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video library',
      details: error.message
    });
  }
});

// 7. Delete video from library
app.delete('/api/videos/:videoId', customAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const User = mongoose.model('User');
    
    const result = await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: {
          generatedVideos: { videoId: videoId }
        }
      },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Video deleted from library',
      videoId: videoId,
      remainingVideos: result.generatedVideos?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error deleting video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video',
      details: error.message
    });
  }
});

// 8. Creatomate Export with Google Storage URLs
app.post('/api/export-creatomate', customAuth, async (req, res) => {
  try {
    if (!creatomateEditor) {
      return res.status(503).json({ error: 'Creatomate editor not available' });
    }

    const { videoFiles, batchId, options = {} } = req.body;
    
    let filesToUse = videoFiles;
    
    if (batchId && !videoFiles) {
      const batch = activeBatches.get(batchId);
      
      if (!batch || batch.userId !== req.user.id) {
        return res.status(403).json({ 
          error: 'Access denied - batch not found or not yours',
          batchId
        });
      }
      
      // Use Google Storage URLs for Creatomate
      if (batch.googleStorageUrls && batch.googleStorageUrls.length > 0) {
        filesToUse = batch.googleStorageUrls;
        console.log(`🎞️ Using ${filesToUse.length} Google Storage URLs for Creatomate`);
      } else {
        return res.status(400).json({ 
          error: 'Batch not ready or no Google Storage URLs found',
          batchId,
          hint: 'Videos may still be processing or uploading to Google Cloud Storage'
        });
      }
    }
    
    if (!filesToUse || filesToUse.length === 0) {
      return res.status(400).json({ error: 'No video files or URLs provided' });
    }
    
    console.log(`🎞️ Starting Creatomate export with Google Storage URLs for user: ${req.user.email}`);
    console.log(`📁 Input URLs: ${filesToUse.slice(0, 3).join(', ')}${filesToUse.length > 3 ? '...' : ''}`);
    
    const result = await creatomateEditor.editVideos(filesToUse, options);
    
    res.json({
      success: true,
      jobId: result.jobId,
      renderJob: result.renderJob,
      status: result.status,
      templateType: result.templateType,
      estimatedTime: result.estimatedTime,
      videoCount: filesToUse.length,
      usingGoogleStorage: true
    });

  } catch (error) {
    console.error('Creatomate export error:', error);
    res.status(500).json({ 
      error: 'Creatomate export failed', 
      details: error.message
    });
  }
});

// Enhanced prompt generation function
async function generateEnhancedPrompts({ characterTemplateId, productTemplateId, scenes, spokenLanguage, sceneDuration, characterAnalyzer, productAnalyzer }) {
  const langConfig = promptGenerator ? promptGenerator.getSpokenLanguageConfig(spokenLanguage) : { voiceInstructions: spokenLanguage };
  
  const prompts = scenes.map((sceneData, index) => {
    const sceneNumber = index + 1;
    
    let prompt = `VEO3 SCENE ${sceneNumber} (${sceneDuration}-second duration):\n\n`;
    
    if (characterTemplateId && characterAnalyzer) {
      try {
        const characterTemplate = characterAnalyzer.loadCharacterTemplate(characterTemplateId);
        if (characterTemplate) {
          const character = characterTemplate.template.character;
          const visualDetails = character.visualRefinement;
          
          prompt += `CHARACTER SPECIFICATION (MUST BE EXACT):\n`;
          prompt += `- Name: ${character.name}\n`;
          prompt += `- Eyes: ${visualDetails.facialFeatures.exactEyeColorAndShape}\n`;
          prompt += `- Hair: ${visualDetails.hair.preciseColor} - ${visualDetails.hair.exactStyleAndCut}\n`;
          prompt += `- Skin: ${visualDetails.skin.skinTone}\n`;
          prompt += `- Build: ${visualDetails.buildAndPosture.exactBodyType}\n`;
          prompt += `- Clothing: ${visualDetails.clothingAndAccessories.specificGarmentTypesAndFit}\n`;
          prompt += `- Demeanor: ${visualDetails.demeanorAndExpressions.feelOfTheirPresence}\n\n`;
        }
      } catch (error) {
        console.warn('Could not load character template:', error.message);
      }
    }
    
    if (productTemplateId && productAnalyzer) {
      try {
        const productTemplate = productAnalyzer.loadProductTemplate(productTemplateId);
        if (productTemplate) {
          const product = productTemplate.template.product;
          const productDetails = product.visualRefinement;
          
          prompt += `PRODUCT SPECIFICATION (MUST BE EXACT):\n`;
          prompt += `- Product: ${product.name} (${product.category})\n`;
          prompt += `- Size/Dimensions: ${productDetails.physicalCharacteristics.exactSizeAndDimensions}\n`;
          prompt += `- Colors: ${productDetails.physicalCharacteristics.colorScheme}\n`;
          prompt += `- Materials: ${productDetails.physicalCharacteristics.materialComposition}\n`;
          prompt += `- Shape/Form: ${productDetails.physicalCharacteristics.shapeAndForm}\n`;
          prompt += `- Distinctive Features: ${productDetails.visualDetails.distinctiveFeatures}\n`;
          prompt += `- Placement: ${product.veo3Consistency.productPlacement}\n\n`;
        }
      } catch (error) {
        console.warn('Could not load product template:', error.message);
      }
    }
    
    prompt += `SCENE DESCRIPTION:\n${sceneData.scene}\n\n`;
    
    if (sceneData.dialogue) {
      prompt += `DIALOGUE (${langConfig.voiceInstructions}):\n"${sceneData.dialogue}"\n\n`;
    }
    
    prompt += `VEO3 TECHNICAL REQUIREMENTS:\n`;
    prompt += `- ${sceneDuration}-second scene duration\n`;
    prompt += `- Professional cinematography with native audio\n`;
    prompt += `- End with medium shot for scene transitions\n\n`;
    
    prompt += `CRITICAL: Maintain exact visual consistency across all scenes.`;
    
    return {
      sceneNumber,
      title: sceneData.title || `Scene ${sceneNumber}`,
      scene: sceneData.scene,
      dialogue: sceneData.dialogue || '',
      prompt: prompt,
      duration: sceneDuration,
      hasCharacter: !!characterTemplateId,
      hasProduct: !!productTemplateId,
      spokenLanguage
    };
  });
  
  const timestamp = Date.now().toString().slice(-6);
  const promptSetId = `enhanced_prompts_${timestamp}`;
  
  return {
    promptSetId,
    prompts,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalScenes: prompts.length,
      sceneDuration,
      spokenLanguage,
      hasCharacter: !!characterTemplateId,
      hasProduct: !!productTemplateId
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🖼️ STATIC FILE SERVING FOR BOTH IMAGES AND VIDEOS
// ═══════════════════════════════════════════════════════════════════════════════════════

// Serve generated images
app.get('/generated/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'generated/images', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Image not found');
  }
});

// Serve uploaded images
app.get('/uploads/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads/images', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Image not found');
  }
});

// Serve character images
app.get('/images/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'images', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Character image not found');
  }
});

// Serve product images
app.get('/product-images/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'product-images', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Product image not found');
  }
});

// Serve videos (with GCS redirect if available)
app.get('/api/videos/:filename', customAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Check if this is a video from the user's library with GCS URL
    const User = mongoose.model('User');
    const user = await User.findById(req.user.id).select('generatedVideos').lean();
    
    if (user && user.generatedVideos) {
      const video = user.generatedVideos.find(v => 
        v.localPath && v.localPath.includes(filename) || 
        v.googleStorageUrl && v.googleStorageUrl.includes(filename)
      );
      
      if (video && video.googleStorageUrl) {
        console.log(`🔗 Redirecting to Google Storage URL for video: ${filename}`);
        return res.redirect(video.googleStorageUrl);
      }
    }
    
    // Fall back to local file serving
    const localPath = path.join(__dirname, 'generated-videos', filename);
    if (fs.existsSync(localPath)) {
      res.sendFile(localPath);
    } else {
      res.status(404).json({ 
        error: 'Video not found',
        message: 'Video may have been moved to Google Cloud Storage'
      });
    }
    
  } catch (error) {
    console.error('❌ Error serving video:', error);
    res.status(500).json({
      error: 'Failed to serve video',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🌐 HTML ROUTES FOR COMPLETE APPLICATION
// ═══════════════════════════════════════════════════════════════════════════════════════

// Serve HTML pages
const serveHtmlFile = (filename) => (req, res) => {
  const filePath = path.join(__dirname, 'public', filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`<h1>Page not found</h1><p>${filename} does not exist</p>`);
  }
};

// Main application routes
app.get('/', serveHtmlFile('index.html'));
app.get('/app', serveHtmlFile('app.html'));
app.get('/pricing', serveHtmlFile('pricing.html'));
app.get('/success', serveHtmlFile('success.html'));
app.get('/login', serveHtmlFile('login.html'));
app.get('/register', serveHtmlFile('register.html'));

// Video application routes
app.get('/videos', serveHtmlFile('videos.html'));

// Image application routes
app.get('/image-studio', serveHtmlFile('image-app.html'));
app.get('/image-credits', serveHtmlFile('image-credits.html'));
app.get('/image-gallery', serveHtmlFile('image-gallery.html'));
app.get('/image-success', serveHtmlFile('image-credits.html'));

// Voeg deze toe na de bestaande routes:

// Legal pages
app.get('/about', serveHtmlFile('about.html'));
app.get('/contact', serveHtmlFile('contact.html'));
app.get('/privacy', serveHtmlFile('privacypolicy.html'));
app.get('/terms', serveHtmlFile('terms.html'));
app.get('/cookies', serveHtmlFile('cookies.html'));


// ═══════════════════════════════════════════════════════════════════════════════════════
// 🔧 DEBUG AND ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════════════

// DEBUG ROUTE to check complete system setup
app.get('/api/debug/complete-setup', requireAuth, (req, res) => {
  const checks = {
    // Image generation checks
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    openaiClient: !!openai,
    sharpAvailable: (() => {
      try {
        require('sharp');
        return true;
      } catch (e) {
        return false;
      }
    })(),
    formDataAvailable: (() => {
      try {
        require('form-data');
        return true;
      } catch (e) {
        return false;
      }
    })(),
    axiosAvailable: (() => {
      try {
        require('axios');
        return true;
      } catch (e) {
        return false;
      }
    })(),
    
    // VEO3 modules checks
    characterAnalyzer: !!characterAnalyzer,
    productAnalyzer: !!productAnalyzer,
    promptGenerator: !!promptGenerator,
    veo3Generator: !!veo3Generator,
    creatomateEditor: !!creatomateEditor,
    
    // Directory checks
    directoriesExist: {
      uploads: fs.existsSync('./uploads/images'),
      generated: fs.existsSync('./generated/images'),
      images: fs.existsSync('./images'),
      productImages: fs.existsSync('./product-images'),
      generatedVideos: fs.existsSync('./generated-videos'),
      editedVideos: fs.existsSync('./edited-videos')
    },
    
    // Database checks
    mongooseConnected: mongoose.connection.readyState === 1,
    
    // Stripe configuration
    stripeConfigured: !!stripe
  };
  
  const allGood = Object.values(checks).every(check => 
    typeof check === 'boolean' ? check : 
    typeof check === 'object' ? Object.values(check).every(Boolean) : 
    Boolean(check)
  );
  
  res.json({
    success: true,
    checks,
    allGood,
    recommendations: allGood ? [] : [
      !checks.openaiConfigured && 'Set OPENAI_API_KEY in environment',
      !checks.sharpAvailable && 'Install Sharp: npm install sharp',
      !checks.formDataAvailable && 'Install FormData: npm install form-data',
      !checks.axiosAvailable && 'Install Axios: npm install axios',
      !checks.characterAnalyzer && 'CharacterAnalyzer module not available',
      !checks.productAnalyzer && 'ProductAnalyzer module not available',
      !checks.veo3Generator && 'VEO3Generator module not available',
      !checks.creatomateEditor && 'CreatomateEditor module not available',
      !checks.directoriesExist.uploads && 'Create uploads/images directory',
      !checks.directoriesExist.generated && 'Create generated/images directory',
      !checks.directoriesExist.images && 'Create images directory',
      !checks.directoriesExist.productImages && 'Create product-images directory',
      !checks.mongooseConnected && 'MongoDB connection failed',
      !checks.stripeConfigured && 'Stripe not configured'
    ].filter(Boolean),
    capabilities: {
      imageGeneration: {
        model: 'gpt-image-1',
        multiImage: true,
        maxImages: 10,
        creditSystem: true
      },
      videoGeneration: {
        model: 'veo3-fast',
        characterAnalysis: checks.characterAnalyzer,
        productAnalysis: checks.productAnalyzer,
        promptGeneration: checks.promptGenerator,
        creatomateEditing: checks.creatomateEditor,
        quotaSystem: true,
        googleCloudStorage: checks.veo3Generator
      }
    },
    version: 'COMPLETE_VIDCRAFT_AI_WITH_GPT_IMAGE_1_AND_VEO3'
  });
});

// Admin route to repair user quota (from original system)
app.post('/api/admin/repair-user-quota', async (req, res) => {
  try {
    const { userId, newLimit } = req.body;
    
    if (!userId || !newLimit) {
      return res.status(400).json({
        error: 'Missing userId or newLimit'
      });
    }
    
    const User = mongoose.model('User');
    const result = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'usage.monthlyLimit': parseInt(newLimit),
          'usage.lastUpdate': new Date()
        }
      },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: `Updated user ${userId} quota to ${newLimit}`,
      user: {
        email: result.email,
        usage: result.usage
      }
    });
    
  } catch (error) {
    console.error('❌ Admin quota repair error:', error);
    res.status(500).json({
      error: 'Failed to repair quota',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🏥 HEALTH CHECK AND SYSTEM STATUS
// ═══════════════════════════════════════════════════════════════════════════════════════

// Comprehensive health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    
    // VEO3 Video Generation Modules
    veo3Modules: {
      characterAnalyzer: characterAnalyzer ? '✅ Ready' : '❌ Not available',
      productAnalyzer: productAnalyzer ? '✅ Ready' : '❌ Not available',
      promptGenerator: promptGenerator ? '✅ Ready' : '❌ Not available',
      veo3Generator: veo3Generator ? '✅ Ready (VEO3 Fast + GCS)' : '❌ Not available',
      creatomateEditor: creatomateEditor ? '✅ Ready' : '❌ Not available'
    },
    
    // GPT-Image-1 Generation Modules
    imageModules: {
      openai: openai ? '✅ Ready (GPT-Image-1)' : '❌ Not available',
      axios: (() => { try { require('axios'); return '✅ Ready'; } catch(e) { return '❌ Not available'; } })(),
      sharp: (() => { try { require('sharp'); return '✅ Ready'; } catch(e) { return '❌ Not available'; } })(),
      formData: (() => { try { require('form-data'); return '✅ Ready'; } catch(e) { return '❌ Not available'; } })()
    },
    
    // Video Quota System
    videoQuotaSystem: {
      type: 'SAFE_QUOTA_SYSTEM_WITH_ENHANCED_VIDEO_STORAGE',
      deductOnSuccess: true,
      saveToDatabase: true,
      googleCloudStorage: true,
      activeBatches: activeBatches.size,
      pendingGenerations: pendingGenerations.size,
      completedVideos: completedVideos.size
    },
    
    // Image Generation System
    imageGeneration: {
      enabled: true,
      model: 'gpt-image-1',
      multiImageSupport: true,
      maxImages: 10,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      uploadsDir: fs.existsSync('./uploads/images'),
      generatedDir: fs.existsSync('./generated/images'),
      creditSystem: true,
      sharpProcessing: true,
      formatConversion: true,
      version: 'GPT_IMAGE_1_MULTI_IMAGE_SYSTEM'
    },
    
    // Video Storage System
    videoStorage: {
      enabled: true,
      storesGoogleUrls: true,
      storesMetadata: true,
      supportsLibrary: true,
      veo3Enhanced: true,
      bucketIntegration: veo3Generator ? veo3Generator.bucketName : 'Not configured'
    },
    
    // VEO3 Integration Details
    veo3Integration: {
      projectId: veo3Generator ? veo3Generator.projectId : 'Not configured',
      location: veo3Generator ? veo3Generator.location : 'Not configured',
      model: veo3Generator ? veo3Generator.modelId : 'Not configured',
      outputDir: veo3Generator ? veo3Generator.outputDir : 'Not configured'
    },
    
    // Payment Systems
    paymentSystems: {
      stripe: !!stripe ? '✅ Configured' : '❌ Not configured',
      imageCredits: !!stripe ? '✅ Available' : '❌ Not available',
      videoSubscriptions: '✅ Available'
    },
    
    // Business Plans Support
    plans: {
      basic: 1,
      pro: 5,
      business: 30,
      enterprise: 100
    },
    
    // Complete System Mode
    mode: 'COMPLETE_VIDCRAFT_AI_WITH_GPT_IMAGE_1_AND_VEO3_VIDEO_GENERATION'
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🛡️ ERROR HANDLING AND 404
// ═══════════════════════════════════════════════════════════════════════════════════════

// Enhanced Multer Error Handling Middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large', 
        message: 'File size must be less than 20MB per image for image generation, 10MB for video character/product images',
        details: error.message
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        success: false,
        error: 'Too many files', 
        message: 'Maximum 10 images allowed for image generation',
        details: error.message
      });
    }
    
    return res.status(400).json({ 
      success: false,
      error: 'Upload error', 
      message: error.message 
    });
  }
  
  // Handle other file upload errors
  if (error.message && error.message.includes('Only image files allowed')) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid file type', 
      message: error.message 
    });
  }
  
  console.error('❌ Server error:', error);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    message: 'This endpoint does not exist in the VidCraft AI system'
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// 🚀 SERVER STARTUP WITH COMPLETE FEATURE OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════════════

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 COMPLETE VIDCRAFT AI - GPT-IMAGE-1 + VEO3 VIDEO GENERATION SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🏠 Homepage: http://localhost:${PORT}`);
  console.log(`🎬 Video App: http://localhost:${PORT}/app`);
  console.log(`🎨 Image Studio: http://localhost:${PORT}/image-studio`);
  console.log(`💰 Pricing: http://localhost:${PORT}/pricing`);
  console.log(`📹 Video Library: http://localhost:${PORT}/videos`);
  console.log(`🖼️ Image Gallery: http://localhost:${PORT}/image-gallery`);
  console.log(`💳 Image Credits: http://localhost:${PORT}/image-credits`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🐛 Debug Complete: http://localhost:${PORT}/api/debug/complete-setup`);
  console.log('');
  
  console.log('🎨 GPT-IMAGE-1 MULTI-IMAGE GENERATION SYSTEM:');
  console.log(`  ✅ Model: GPT-Image-1 (Latest OpenAI)`);
  console.log(`  📷 Multi-Image Support: Up to 10 images per generation`);
  console.log(`  🎭 Generation Modes: Generate, Edit & Compose, Variation`);
  console.log(`  🎨 Quality Options: Low/Medium/High/Auto`);
  console.log(`  📏 Size Options: Square/Portrait/Landscape/Custom`);
  console.log(`  📁 Output Formats: PNG/JPEG/WebP with compression`);
  console.log(`  💳 Credit System: Pay-per-image with Stripe integration`);
  console.log(`  🖼️ Gallery Management: Full CRUD operations`);
  console.log('');
  
  console.log('🎬 VEO3 VIDEO GENERATION SYSTEM:');
  console.log(`  ✅ VEO3 Fast Model: ${veo3Generator ? veo3Generator.modelId : 'Not configured'}`);
  console.log(`  ☁️ Google Cloud Project: ${veo3Generator ? veo3Generator.projectId : 'Not configured'}`);
  console.log(`  📦 Storage Bucket: ${veo3Generator ? veo3Generator.bucketName : 'Not configured'}`);
  console.log(`  📁 Local Output: ${veo3Generator ? veo3Generator.outputDir : 'Not configured'}`);
  console.log(`  🎭 Character Analysis: ${characterAnalyzer ? '✅ Active' : '❌ Disabled'}`);
  console.log(`  📦 Product Analysis: ${productAnalyzer ? '✅ Active' : '❌ Disabled'}`);
  console.log(`  📝 Prompt Generation: ${promptGenerator ? '✅ Active' : '❌ Disabled'}`);
  console.log(`  🎞️ Creatomate Editing: ${creatomateEditor ? '✅ Active' : '❌ Disabled'}`);
  console.log('');
  
  console.log('💾 ENHANCED DATABASE STORAGE:');
  console.log('  ✅ Save every Google Storage URL to MongoDB');
  console.log('  ✅ Track video metadata (title, size, duration, dialogue)');
  console.log('  ✅ Store image metadata (prompt, quality, size, format)');
  console.log('  ✅ Store VEO3 operation data and costs');
  console.log('  ✅ Video library with search and filtering');
  console.log('  ✅ Image gallery with full management');
  console.log('  ✅ Video deletion and management');
  console.log('  ✅ Image deletion and management');
  console.log('  ✅ Batch grouping and organization');
  console.log('  ✅ Direct Google Cloud Storage integration');
  console.log('');
  
  console.log('🛡️ DUAL QUOTA & CREDIT SYSTEMS:');
  console.log('  📹 Videos: Only deduct on successful completion');
  console.log('  🖼️ Images: Credit-based system with instant deduction');
  console.log('  ✅ Save content to database with full metadata');
  console.log('  ✅ No loss on generation failures');
  console.log('  ✅ Automatic error recovery and cleanup');
  console.log('  ✅ Google Storage URL preservation');
  console.log('');
  
  console.log('🎨 GPT-IMAGE-1 API ENDPOINTS:');
  console.log('  📷 POST /api/generate-image - Generate AI images with GPT-Image-1');
  console.log('  📦 GET /api/image-credits/packages - Get credit packages');
  console.log('  💳 POST /api/image-credits/purchase - Purchase credits');
  console.log('  🔍 POST /api/image-credits/verify-payment - Verify payment');
  console.log('  📊 GET /api/image-credits/status - Get credit status');
  console.log('  🖼️ GET /api/image-gallery - Get image gallery');
  console.log('  🗑️ DELETE /api/image-gallery/:imageId - Delete image');
  console.log('');
  
  console.log('🎬 VEO3 VIDEO API ENDPOINTS:');
  console.log('  🎭 POST /api/analyze-character - Analyze character images');
  console.log('  📦 POST /api/analyze-product - Analyze product images');
  console.log('  📝 POST /api/generate-prompts - Generate enhanced prompts');
  console.log('  🎬 POST /api/generate-veo3-videos - Generate VEO3 videos');
  console.log('  📊 GET /api/batch-status/:batchId - Enhanced batch status');
  console.log('  📹 GET /api/videos/library - Get user video library');
  console.log('  🗑️ DELETE /api/videos/:videoId - Delete video');
  console.log('  🎞️ POST /api/export-creatomate - Export with GCS URLs');
  console.log('  💾 GET /api/videos/:filename - Video serving with GCS redirect');
  console.log('');
  
  console.log('👤 AUTHENTICATION & USER MANAGEMENT:');
  console.log('  👤 GET /api/auth/me - Enhanced user info with videos & images');
  console.log('  🔐 Dual auth systems: requireAuth + customAuth');
  console.log('  📊 Complete usage tracking and analytics');
  console.log('');
  
  console.log('💼 BUSINESS PLAN SUPPORT:');
  console.log('  🟢 Enterprise: 100 videos/month');
  console.log('  🟠 Business: 30 videos/month');
  console.log('  🟡 Pro: 5 videos/month');
  console.log('  🔵 Basic: 1 video/month');
  console.log('  🔧 POST /api/admin/repair-user-quota - Plan repair');
  console.log('');
  
  console.log('💡 EXAMPLE GPT-IMAGE-1 PROMPTS:');
  console.log('  👔 "Put clothing from image 1 on person in image 2"');
  console.log('  🎨 "Combine all images into artistic composition"');
  console.log('  🌟 "Transform person in image 1 to match style of image 2"');
  console.log('  👗 "Create fashion photoshoot combining elements from all images"');
  console.log('');
  
  console.log('💡 EXAMPLE VEO3 VIDEO WORKFLOWS:');
  console.log('  1️⃣ Upload character/product images → Analyze → Generate prompts');
  console.log('  2️⃣ Generate VEO3 videos with Google Cloud Storage');
  console.log('  3️⃣ Videos auto-saved to database with full metadata');
  console.log('  4️⃣ Export to Creatomate for professional editing');
  console.log('  5️⃣ Manage video library with search and filtering');
  console.log('');
  
  console.log('✨ COMPLETE SYSTEM READY!');
  console.log('🌐 All videos automatically uploaded to Google Cloud Storage!');
  console.log('🎨 Professional AI image generation with GPT-Image-1 multi-image support!');
  console.log('📚 Complete video & image library management systems enabled!');
  console.log('🔧 ALL ORIGINAL FEATURES PRESERVED + NEW CAPABILITIES ADDED!');
  console.log('🎯 Multi-image composition with up to 10 images at once!');
  console.log('🚀 Advanced image editing, generation and variation modes!');
  console.log('🎬 Professional video generation with character and product analysis!');
  console.log('💳 Dual payment systems: Credits for images, subscriptions for videos!');
  console.log('🏢 Full business plan support with quota management!');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
});

console.log('✅ Complete VidCraft AI system with GPT-Image-1 + VEO3 initialized');
console.log('💳 Available image credit packages:', Object.keys(CREDIT_PACKAGES));
console.log('🔗 Stripe integration ready for image credits');
console.log('🎬 VEO3 video generation with enhanced storage ready');

module.exports = app;