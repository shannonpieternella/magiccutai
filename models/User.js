// models/User.js - ENHANCED WITH VIDEO STORAGE + CREDITS + IMAGES
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
     type: String,
     required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
     type: String,
     required: [true, 'Last name is required'],
    trim: true
  },
  username: {
     type: String,
     required: [true, 'Username is required'],
     unique: true,
    trim: true,
    lowercase: true
  },
  email: {
     type: String,
     required: [true, 'Email is required'],
     unique: true,
    trim: true,
    lowercase: true
  },
  password: {
     type: String,
     required: [true, 'Password is required']
  },
  subscription: {
    plan: {
       type: String,
       enum: ['free', 'starter', 'pro', 'business'],
       default: 'free'
     },
    status: {
       type: String,
       enum: ['active', 'inactive', 'cancelled'],
       default: 'active'
     },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    startDate: Date,
    endDate: Date
  },
  usage: {
    videosGenerated: { type: Number, default: 0 },
    monthlyLimit: { type: Number, default: 3 }, // Free tier gets 3 videos
    lastResetDate: { type: Date, default: Date.now }
  },
  
  // 🪙 NEW: Credits System
  credits: {
    available: { type: Number, default: 3 }, // 3 gratis credits
    used: { type: Number, default: 0 },
    totalPurchased: { type: Number, default: 0 },
    lastPurchase: { type: Date },
    packages: [{
      amount: Number,
      credits: Number, 
      purchaseDate: Date,
      stripeSessionId: String
    }]
  },
  
  // 🖼️ NEW: Generated Images Storage
  generatedImages: [{
    imageId: {
      type: String,
      required: true,
      //index: true
    },
    originalPrompt: String,
    editPrompt: String,
    originalImageUrls: [String],
    generatedImageUrl: String,
    localPath: String,
    size: {
      type: Number,
      default: 0
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    creditsUsed: { 
      type: Number, 
      default: 1 
    },
    metadata: {
      model: String,
      quality: String,
      style: String,
      editType: String
    }
  }],
  
  // 🎬 Generated Videos Storage (existing)
  generatedVideos: [{
    videoId: {
      type: String,
      required: true,
      //index: true
    },
    title: {
      type: String,
      required: true
    },
    sceneNumber: {
      type: Number,
      default: 1
    },
    batchId: {
      type: String,
      required: true
     
    },
    
    // 🌐 Storage URLs
    googleStorageUrl: {
      type: String,
      required: true
    },
    publicUrl: {
      type: String,
      required: true
    },
    localPath: String,
    bucketName: String,
    gcsFileName: String,
    
    // 📊 Video Properties
    size: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 8
    },
    
    // 📝 Content
    prompt: String,
    dialogue: String,
    
    // ⚙️ Generation Settings
    model: {
      type: String,
      default: 'veo3-fast'
    },
    aspectRatio: {
      type: String,
      default: '16:9'
    },
    hasCharacter: {
      type: Boolean,
      default: false
    },
    hasProduct: {
      type: Boolean,
      default: false
    },
    spokenLanguage: {
      type: String,
      default: 'en'
    },
    
    // 🎬 VEO3 Specific Data
    veo3Data: {
      operationId: String,
      estimatedCost: {
        type: Number,
        default: 1.20
      },
      downloadedAt: Date,
      source: {
        type: String,
        default: 'veo3-gcs'
      }
    },
    
    // 📅 Timestamps
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 🎥 Edited Videos Storage
  editedVideos: [{
    templateId: {
      type: String,
      required: true
    },
    modifications: {
      type: Object,
      default: {}
    },
    publicUrl: {
      type: String,
      required: true
    },
    storageUrl: String,
    duration: {
      type: Number,
      default: 0
    },
    fileSize: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// 🔍 Indexes for efficient queries
userSchema.index({ 'generatedVideos.videoId': 1 });
userSchema.index({ 'generatedVideos.batchId': 1 });
userSchema.index({ 'generatedVideos.createdAt': -1 });
userSchema.index({ 'generatedImages.imageId': 1 });
userSchema.index({ 'generatedImages.createdAt': -1 });

// Virtual: Check if user has active subscription
userSchema.virtual('hasActiveSubscription').get(function() {
  return this.subscription.status === 'active' && this.subscription.plan !== 'free';
});

// Virtual: Check if user can generate more videos
userSchema.virtual('canGenerateVideos').get(function() {
  return this.usage.videosGenerated < this.usage.monthlyLimit;
});

// 🪙 NEW: Virtual for credits info
userSchema.virtual('creditsInfo').get(function() {
  return {
    available: this.credits.available,
    used: this.credits.used,
    total: this.credits.totalPurchased + 3, // 3 free credits + purchased
    canGenerateImages: this.credits.available > 0,
    lastPurchase: this.credits.lastPurchase,
    packages: this.credits.packages || []
  };
});

// 🖼️ NEW: Virtual for image library stats
userSchema.virtual('imageLibrary').get(function() {
  const images = this.generatedImages || [];
  
  // Calculate total size in MB
  const totalSize = images.reduce((sum, image) => sum + (image.size || 0), 0);
  
  // Calculate this month's images
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const thisMonthImages = images.filter(image => 
    new Date(image.createdAt) >= thisMonth
  ).length;
  
  // Calculate total credits used for images
  const totalCreditsUsed = images.reduce((sum, image) => sum + (image.creditsUsed || 1), 0);
  
  return {
    totalImages: images.length,
    totalSize: Math.round(totalSize),
    thisMonth: thisMonthImages,
    totalCreditsUsed: totalCreditsUsed,
    models: [...new Set(images.map(i => i.metadata?.model).filter(Boolean))],
    styles: [...new Set(images.map(i => i.metadata?.style).filter(Boolean))],
    images: images
  };
});

// 🎬 Existing: Virtual for video library stats
userSchema.virtual('videoLibrary').get(function() {
  const videos = this.generatedVideos || [];
  
  // Calculate total size in MB
  const totalSize = videos.reduce((sum, video) => sum + (video.size || 0), 0);
  
  // Calculate this month's videos
  const thisMonth = new Date();
  thisMonth.setDate(1);
  const thisMonthVideos = videos.filter(video => 
    new Date(video.createdAt) >= thisMonth
  ).length;
  
  // Group by batch
  const batchGroups = {};
  videos.forEach(video => {
    if (!batchGroups[video.batchId]) {
      batchGroups[video.batchId] = [];
    }
    batchGroups[video.batchId].push(video);
  });
  
  return {
    totalVideos: videos.length,
    totalSize: Math.round(totalSize),
    thisMonth: thisMonthVideos,
    batchCount: Object.keys(batchGroups).length,
    languages: [...new Set(videos.map(v => v.spokenLanguage).filter(Boolean))],
    models: [...new Set(videos.map(v => v.model).filter(Boolean))],
    videos: videos
  };
});

// Method: Update plan limits based on subscription
userSchema.methods.updatePlanLimits = function() {
  const planLimits = {
    free: 3,
    starter: 5,
    pro: 15,
    business: 30
  };
     
  this.usage.monthlyLimit = planLimits[this.subscription.plan] || 3;
};

// Method: Reset monthly usage (call this monthly via cron job)
userSchema.methods.resetMonthlyUsage = function() {
  this.usage.videosGenerated = 0;
  this.usage.lastResetDate = new Date();
};

// Method: Increment video count
userSchema.methods.incrementVideoCount = function() {
  this.usage.videosGenerated += 1;
};

// 🪙 NEW: Credits Management Methods
userSchema.methods.hasCredits = function(amount = 1) {
  return this.credits.available >= amount;
};

userSchema.methods.useCredits = function(amount = 1) {
  if (!this.hasCredits(amount)) {
    throw new Error('Insufficient credits');
  }
  
  this.credits.available -= amount;
  this.credits.used += amount;
  console.log(`💳 Used ${amount} credits for user ${this.email}. Remaining: ${this.credits.available}`);
  return true;
};

userSchema.methods.addCredits = function(amount, packageInfo = null) {
  this.credits.available += amount;
  this.credits.totalPurchased += amount;
  this.credits.lastPurchase = new Date();
  
  if (packageInfo) {
    this.credits.packages.push({
      ...packageInfo,
      purchaseDate: new Date()
    });
  }
  
  console.log(`💰 Added ${amount} credits to user ${this.email}. New balance: ${this.credits.available}`);
  return true;
};

// 🖼️ NEW: Image Management Methods
userSchema.methods.addImage = function(imageData) {
  // Ensure imageId is unique
  const existingImage = this.generatedImages.find(i => i.imageId === imageData.imageId);
  if (existingImage) {
    console.log(`⚠️ Image ${imageData.imageId} already exists, skipping...`);
    return false;
  }
  
  this.generatedImages.push(imageData);
  console.log(`✅ Added image ${imageData.imageId} to user ${this.email}`);
  return true;
};

userSchema.methods.removeImage = function(imageId) {
  const initialLength = this.generatedImages.length;
  this.generatedImages = this.generatedImages.filter(i => i.imageId !== imageId);
  const removed = this.generatedImages.length < initialLength;
  
  if (removed) {
    console.log(`🗑️ Removed image ${imageId} from user ${this.email}`);
  }
  
  return removed;
};

userSchema.methods.getImage = function(imageId) {
  return this.generatedImages.find(i => i.imageId === imageId);
};

// 🎬 Existing: Video Management Methods
userSchema.methods.addVideo = function(videoData) {
  // Ensure videoId is unique
  const existingVideo = this.generatedVideos.find(v => v.videoId === videoData.videoId);
  if (existingVideo) {
    console.log(`⚠️ Video ${videoData.videoId} already exists, skipping...`);
    return false;
  }
  
  this.generatedVideos.push(videoData);
  console.log(`✅ Added video ${videoData.videoId} to user ${this.email}`);
  return true;
};

userSchema.methods.removeVideo = function(videoId) {
  const initialLength = this.generatedVideos.length;
  this.generatedVideos = this.generatedVideos.filter(v => v.videoId !== videoId);
  const removed = this.generatedVideos.length < initialLength;
  
  if (removed) {
    console.log(`🗑️ Removed video ${videoId} from user ${this.email}`);
  }
  
  return removed;
};

userSchema.methods.getVideo = function(videoId) {
  return this.generatedVideos.find(v => v.videoId === videoId);
};

userSchema.methods.getVideosByBatch = function(batchId) {
  return this.generatedVideos.filter(v => v.batchId === batchId);
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      console.log('🔐 Hashing password...');
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      console.log('🔐 Password hashed successfully');
    } catch (error) {
      console.error('🔐 Password hashing error:', error);
      return next(error);
    }
  }
     
  // Update plan limits if subscription plan changed
  if (this.isModified('subscription.plan')) {
    this.updatePlanLimits();
  }
     
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('🔐 Password comparison error:', error);
    return false;
  }
};

// Get subscription info with video and image stats
userSchema.methods.getSubscriptionInfo = function() {
  const videoLibrary = this.videoLibrary;
  const imageLibrary = this.imageLibrary;
  const creditsInfo = this.creditsInfo;
  
  return {
    plan: this.subscription.plan,
    status: this.subscription.status,
    videoLimit: this.usage.monthlyLimit,
    videosUsed: this.usage.videosGenerated,
    videosRemaining: this.usage.monthlyLimit - this.usage.videosGenerated,
    hasActiveSubscription: this.hasActiveSubscription,
    canGenerateVideos: this.canGenerateVideos,
    
    // 🪙 Credits info
    credits: creditsInfo,
    
    // 🎬 Video library stats
    videoLibrary: {
      totalVideos: videoLibrary.totalVideos,
      totalSize: videoLibrary.totalSize,
      thisMonth: videoLibrary.thisMonth,
      batchCount: videoLibrary.batchCount
    },
    
    // 🖼️ Image library stats
    imageLibrary: {
      totalImages: imageLibrary.totalImages,
      totalSize: imageLibrary.totalSize,
      thisMonth: imageLibrary.thisMonth,
      totalCreditsUsed: imageLibrary.totalCreditsUsed
    }
  };
};

// 🖼️ NEW: Static method to find users with images
userSchema.statics.findUsersWithImages = function() {
  return this.find({ 
    'generatedImages.0': { $exists: true } 
  }).select('email generatedImages');
};

// 🖼️ NEW: Static method to get image storage stats
userSchema.statics.getImageStorageStats = async function() {
  const pipeline = [
    { $unwind: '$generatedImages' },
    { 
      $group: {
        _id: null,
        totalImages: { $sum: 1 },
        totalSize: { $sum: '$generatedImages.size' },
        avgSize: { $avg: '$generatedImages.size' },
        totalCreditsUsed: { $sum: '$generatedImages.creditsUsed' },
        models: { $addToSet: '$generatedImages.metadata.model' },
        styles: { $addToSet: '$generatedImages.metadata.style' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalImages: 0,
    totalSize: 0,
    avgSize: 0,
    totalCreditsUsed: 0,
    models: [],
    styles: []
  };
};

// 🪙 NEW: Static method to get credits statistics
userSchema.statics.getCreditsStats = async function() {
  const pipeline = [
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalCreditsAvailable: { $sum: '$credits.available' },
        totalCreditsUsed: { $sum: '$credits.used' },
        totalCreditsPurchased: { $sum: '$credits.totalPurchased' },
        avgCreditsPerUser: { $avg: '$credits.available' },
        usersWithPurchases: {
          $sum: {
            $cond: [{ $gt: ['$credits.totalPurchased', 0] }, 1, 0]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalUsers: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    totalCreditsPurchased: 0,
    avgCreditsPerUser: 0,
    usersWithPurchases: 0
  };
};

// 🎬 Existing: Static method to find users with videos
userSchema.statics.findUsersWithVideos = function() {
  return this.find({ 
    'generatedVideos.0': { $exists: true } 
  }).select('email generatedVideos');
};

// 🎬 Existing: Static method to get video storage stats
userSchema.statics.getVideoStorageStats = async function() {
  const pipeline = [
    { $unwind: '$generatedVideos' },
    { 
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalSize: { $sum: '$generatedVideos.size' },
        avgSize: { $avg: '$generatedVideos.size' },
        languages: { $addToSet: '$generatedVideos.spokenLanguage' },
        models: { $addToSet: '$generatedVideos.model' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalVideos: 0,
    totalSize: 0,
    avgSize: 0,
    languages: [],
    models: []
  };
};

module.exports = mongoose.model('User', userSchema);