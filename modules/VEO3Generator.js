const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

class VEO3Generator {
  
  constructor(options = {}) {
    this.projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID || 'contentgen-465421';
    this.location = options.location || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.apiEndpoint = `${this.location}-aiplatform.googleapis.com`;
    this.modelId = 'veo-3.0-fast-generate-preview'; // VEO3 FAST!
    this.outputDir = options.outputDir || './generated-videos';
    
    // Google Cloud Storage setup - use the same bucket as images
    this.bucketName = options.bucketName || 'glossy-infinity-413804-ai-images';
    this.storage = new Storage({ projectId: this.projectId });
    this.bucket = this.storage.bucket(this.bucketName);
    
    // Ensure output directory exists (sync)
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Created videos directory: ${this.outputDir}`);
    }
    
    this.bucketInitialized = false;
    
    console.log('🎬 VEO3Generator initialized (VEO3 FAST + GCS Upload)');
    console.log(`   - Project ID: ${this.projectId}`);
    console.log(`   - Location: ${this.location}`);
    console.log(`   - Model: ${this.modelId} (VEO3 FAST)`);
    console.log(`   - Output Dir: ${this.outputDir}`);
    console.log(`   - Storage Bucket: ${this.bucketName}`);
  }

  // Initialize Google Cloud Storage bucket (called when needed)
  async ensureBucketExists() {
    if (this.bucketInitialized) return;
    
    try {
      const [bucketExists] = await this.bucket.exists();
      if (!bucketExists) {
        console.log(`📦 Creating Google Cloud Storage bucket: ${this.bucketName}`);
        await this.bucket.create({
          location: this.location.toUpperCase(),
          storageClass: 'STANDARD',
          publicReadAccess: false // Keep private for security
        });
        console.log(`✅ Bucket created: ${this.bucketName}`);
      } else {
        console.log(`✅ Bucket exists: ${this.bucketName}`);
      }
      this.bucketInitialized = true;
    } catch (error) {
      console.log(`⚠️ Bucket initialization failed: ${error.message}`);
      console.log(`💡 Will use local storage only`);
    }
  }

  // Generate VEO3 Fast videos from prompts
  async generateVideos(prompts, options = {}) {
    console.log(`\n🎬 STARTING VEO3 FAST VIDEO GENERATION`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`📦 Total prompts: ${prompts.length}`);
    console.log(`⏱️ Duration: ${options.durationSeconds || 8} seconds`);
    console.log(`📐 Aspect ratio: ${options.aspectRatio || '16:9'}`);
    console.log(`🔊 Audio: ${options.generateAudio !== false ? 'Yes' : 'No'}`);
    
    try {
      const results = [];
      const batchId = this.generateBatchId();
      
      for (let i = 0; i < prompts.length; i++) {
        const promptData = prompts[i];
        console.log(`\n🎥 Processing Scene ${promptData.sceneNumber}: ${promptData.title}`);
        
        const result = await this.generateSingleVideo(promptData, options, batchId);
        results.push(result);
        
        // Small delay between requests to avoid rate limiting
        if (i < prompts.length - 1) {
          console.log('⏳ Waiting 2 seconds before next generation...');
          await this.sleep(2000);
        }
      }
      
      console.log(`\n✅ ALL ${results.length} VIDEOS GENERATION STARTED`);
      console.log(`   - Batch ID: ${batchId}`);
      console.log(`   - Estimated cost: $${(results.length * 1.20).toFixed(2)} (VEO3 Fast)`);
      console.log(`   - Check status with: checkAllVideosStatus(batchId)`);
      
      return {
        batchId,
        results,
        totalVideos: results.length,
        estimatedCost: results.length * 1.20,
        status: 'generating'
      };
      
    } catch (error) {
      console.error(`❌ VEO3 video generation failed: ${error.message}`);
      throw new Error(`VEO3 generation failed: ${error.message}`);
    }
  }

  // Generate single video
  async generateSingleVideo(promptData, options = {}, batchId) {
    console.log(`📝 Prompt preview: "${promptData.prompt.substring(0, 100)}..."`);
    
    try {
      // Check authentication
      await this.checkAuthentication();
      
      // Prepare request payload
      const requestPayload = {
        instances: [
          {
            prompt: promptData.prompt
          }
        ],
        parameters: {
          aspectRatio: options.aspectRatio || '16:9',
          sampleCount: 1,
          durationSeconds: String(options.durationSeconds || 8),
          personGeneration: options.personGeneration || 'allow_all',
          addWatermark: options.addWatermark !== false,
          includeRaiReason: true,
          generateAudio: options.generateAudio !== false
        }
      };
      
      console.log(`🚀 Calling VEO3 Fast API...`);
      
      // Make API call
      const response = await this.callVEO3API(requestPayload);
      
      const operationId = this.extractOperationId(response);
      const videoId = `${batchId}_scene_${promptData.sceneNumber}`;
      
      console.log(`✅ Generation started for Scene ${promptData.sceneNumber}`);
      console.log(`   - Operation ID: ${operationId}`);
      console.log(`   - Video ID: ${videoId}`);
      
      return {
        videoId,
        sceneNumber: promptData.sceneNumber,
        title: promptData.title,
        operationId,
        status: 'generating',
        prompt: promptData.prompt,
        options: requestPayload.parameters,
        startTime: new Date().toISOString(),
        estimatedCost: 1.20
      };
      
    } catch (error) {
      console.error(`❌ Failed to generate Scene ${promptData.sceneNumber}: ${error.message}`);
      return {
        videoId: `${batchId}_scene_${promptData.sceneNumber}`,
        sceneNumber: promptData.sceneNumber,
        title: promptData.title,
        status: 'failed',
        error: error.message,
        startTime: new Date().toISOString()
      };
    }
  }

  // Call VEO3 API
  async callVEO3API(requestPayload) {
    const accessToken = await this.getAccessToken();
    const url = `https://${this.apiEndpoint}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.modelId}:predictLongRunning`;
    
    const response = await axios.post(url, requestPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 30000
    });
    
    return response.data;
  }

  // Check video generation status with robust error handling
  async checkVideoStatus(operationId) {
    console.log(`🔍 Checking status for operation: ${operationId.split('/').pop().substring(0, 8)}...`);
    
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://${this.apiEndpoint}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.modelId}:fetchPredictOperation`;
      
      const response = await axios.post(url, {
        operationName: operationId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const result = response.data;
      
      if (result.done) {
        if (result.error) {
          console.log(`❌ Generation failed: ${result.error.message}`);
          return {
            status: 'failed',
            error: result.error.message
          };
        } else {
          console.log(`✅ Generation completed successfully`);
          
          // Extract video data
          const videoData = this.extractVideoDataFixed(result);
          return {
            status: 'completed',
            videoData: videoData,
            result: result
          };
        }
      } else {
        console.log(`⏳ Still generating...`);
        return {
          status: 'generating',
          progress: this.extractProgress(result)
        };
      }
      
    } catch (error) {
      if (error.response) {
        if (error.response.status === 404) {
          console.log(`⚠️ Operation not found (may be expired after 48h)`);
          return {
            status: 'expired',
            error: 'Operation expired or not found'
          };
        } else {
          console.error(`❌ Status check failed with status ${error.response.status}: ${error.response.data.error ? error.response.data.error.message : error.response.data}`);
          return {
            status: 'error',
            error: error.response.data.error ? error.response.data.error.message : `HTTP ${error.response.status}`
          };
        }
      } else if (error.request) {
        console.error(`❌ Status check failed: No response received: ${error.message}`);
        return {
          status: 'error',
          error: 'No response from server'
        };
      } else {
        console.error(`❌ Status check failed: ${error.message}`);
        return {
          status: 'error',
          error: error.message
        };
      }
    }
  }

  // Extract video data with multiple fallback methods
  extractVideoDataFixed(result) {
    console.log(`🔍 Extracting video data from VEO3 response...`);
    
    try {
      // Log response structure for debugging
      console.log(`📋 Response keys: ${Object.keys(result).join(', ')}`);
      
      if (result.response) {
        console.log(`🔍 Response object keys: ${Object.keys(result.response).join(', ')}`);
        
        // METHOD 1: Standard predictions array
        if (result.response.predictions && result.response.predictions.length > 0) {
          console.log(`📄 Method 1: Found predictions array`);
          return this.extractFromPrediction(result.response.predictions[0]);
        }
        
        // METHOD 2: Direct response scan
        const directScan = this.scanForVideoData(result.response, 'response');
        if (directScan) return directScan;
      }
      
      // METHOD 3: Root level scan
      const rootScan = this.scanForVideoData(result, 'root');
      if (rootScan) return rootScan;
      
      // METHOD 4: Deep recursive scan
      console.log(`📄 Method 4: Deep recursive scanning...`);
      return this.deepScanForVideo(result);
      
    } catch (error) {
      console.error(`❌ Video extraction failed: ${error.message}`);
      throw new Error(`Failed to extract video data: ${error.message}`);
    }
  }

  // Extract from prediction object
  extractFromPrediction(prediction) {
    console.log(`🔍 Prediction keys: ${Object.keys(prediction).join(', ')}`);
    
    // Check for various video properties
    const videoProps = ['videoBytes', 'bytes', 'bytesBase64Encoded', 'content', 'data'];
    const urlProps = ['uri', 'url', 'gcsUri', 'videoUri'];
    
    // Try video data properties
    for (const prop of videoProps) {
      if (prediction[prop] && typeof prediction[prop] === 'string' && prediction[prop].length > 1000) {
        console.log(`📄 Found base64 video in: ${prop} (${prediction[prop].length} chars)`);
        return { 
          type: 'base64', 
          data: prediction[prop], 
          mimeType: prediction.mimeType || 'video/mp4',
          sourceProperty: prop
        };
      }
    }
    
    // Try URL properties
    for (const prop of urlProps) {
      if (prediction[prop] && typeof prediction[prop] === 'string' && prediction[prop].startsWith('http')) {
        console.log(`📄 Found video URL in: ${prop}`);
        return { 
          type: 'url', 
          data: prediction[prop],
          sourceProperty: prop
        };
      }
    }
    
    throw new Error(`No video data in prediction. Keys: ${Object.keys(prediction).join(', ')}`);
  }

  // Scan object for video data
  scanForVideoData(obj, context) {
    console.log(`🔍 Scanning ${context} for video data...`);
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Check for base64 video (large strings)
        if (value.length > 1000 && this.isBase64Video(value)) {
          console.log(`📄 Found base64 video in ${context}.${key} (${value.length} chars)`);
          return { 
            type: 'base64', 
            data: value, 
            mimeType: 'video/mp4',
            sourceProperty: `${context}.${key}`
          };
        }
        
        // Check for video URLs
        if (value.startsWith('http') && (value.includes('video') || value.includes('.mp4'))) {
          console.log(`📄 Found video URL in ${context}.${key}`);
          return { 
            type: 'url', 
            data: value,
            sourceProperty: `${context}.${key}`
          };
        }
      }
    }
    
    return null;
  }

  // Deep recursive scan for video content
  deepScanForVideo(obj, path = '') {
    if (typeof obj !== 'object' || obj === null) return null;
    
    // Check current level
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        if (value.length > 1000 && this.isBase64Video(value)) {
          console.log(`📄 DEEP SCAN: Found base64 at ${currentPath} (${value.length} chars)`);
          return { 
            type: 'base64', 
            data: value, 
            mimeType: 'video/mp4',
            sourceProperty: currentPath
          };
        }
        
        if (value.startsWith('http') && (value.includes('video') || value.includes('.mp4'))) {
          console.log(`📄 DEEP SCAN: Found URL at ${currentPath}`);
          return { 
            type: 'url', 
            data: value,
            sourceProperty: currentPath
          };
        }
      }
      
      // Recursive search
      if (typeof value === 'object' && value !== null) {
        const nestedResult = this.deepScanForVideo(value, currentPath);
        if (nestedResult) return nestedResult;
      }
    }
    
    throw new Error('No video data found in deep scan');
  }

  // Check if string is base64 video
  isBase64Video(str) {
    if (str.length < 1000) return false;
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  }

  // Process video data and upload to GCS
  async processVideoData(videoData, videoId) {
    console.log(`📥 Processing video data for: ${videoId}`);
    console.log(`📊 Data type: ${videoData.type}`);
    
    try {
      if (videoData.type === 'url') {
        return await this.downloadVideoFromURL(videoData.data, videoId);
      } 
      else if (videoData.type === 'base64') {
        return await this.saveAndUploadVideoToGCS(videoData.data, videoId);
      } 
      else {
        throw new Error(`Unknown video data type: ${videoData.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Video processing failed for ${videoId}: ${error.message}`);
      throw error;
    }
  }

  // Save base64 video and upload to GCS
  async saveAndUploadVideoToGCS(base64Data, videoId) {
    console.log(`💾 Saving and uploading VEO3 video to GCS...`);
    
    const tempDir = './temp_videos';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
      // Clean base64 data and convert to binary
      const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
      const binaryData = Buffer.from(cleanBase64, 'base64');
      
      const timestamp = Date.now();
      const fileName = `veo3_fast_${videoId}_${timestamp}.mp4`;
      const filePath = path.join(tempDir, fileName);
      
      // Save locally first
      fs.writeFileSync(filePath, binaryData);
      const fileSizeMB = (binaryData.length / 1024 / 1024).toFixed(1);
      console.log(`💾 Video saved locally: ${filePath} (${fileSizeMB}MB)`);
      
      // Upload to GCS - use the configured bucket
      const bucketName = this.bucketName;
      const gcsFileName = `veo3-videos/${fileName}`;
      
      console.log(`☁️ Uploading to GCS bucket: ${bucketName}/${gcsFileName}`);
      
      const accessToken = await this.getAccessToken();
      
      // Ensure bucket exists
      await this.ensureGCSBucketExists(bucketName, accessToken);
      
      // Upload file
      const fileData = fs.readFileSync(filePath);
      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(gcsFileName)}`;
      
      const uploadResponse = await axios.post(uploadUrl, fileData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'video/mp4',
          'Content-Length': fileData.length
        },
        timeout: 300000 // 5 minute timeout
      });
      
      console.log(`✅ Upload successful: ${uploadResponse.status}`);
      
      // Make public for access
      try {
        const aclUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(gcsFileName)}/acl`;
        await axios.post(aclUrl, { 
          entity: 'allUsers', 
          role: 'READER' 
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`🌐 Video made public`);
      } catch (error) {
        console.log(`⚠️ Could not make video public: ${error.message}`);
      }
      
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
      
      // Save to output directory
      const localOutputPath = path.join(this.outputDir, fileName);
      fs.writeFileSync(localOutputPath, binaryData);
      
      // Clean up temp file
      fs.unlinkSync(filePath);
      
      return {
        fileName,
        localFilePath: localOutputPath,
        publicUrl: publicUrl,
        bucketName: bucketName,
        gcsFileName: gcsFileName,
        size: binaryData.length,
        sizeMB: fileSizeMB,
        source: 'base64_gcs'
      };
      
    } catch (error) {
      console.error(`❌ Failed to upload video: ${error.message}`);
      throw new Error(`Video upload failed: ${error.message}`);
    }
  }

  // Download from URL and upload to GCS
  async downloadVideoFromURL(videoUrl, videoId) {
    console.log(`📥 Downloading video from URL: ${videoId}`);
    
    try {
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000
      });
      
      const binaryData = Buffer.from(response.data);
      return await this.saveAndUploadVideoToGCS(binaryData.toString('base64'), videoId);
      
    } catch (error) {
      console.error(`❌ Download failed: ${error.message}`);
      throw error;
    }
  }

  // Ensure GCS bucket exists
  async ensureGCSBucketExists(bucketName, accessToken) {
    try {
      const checkUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
      await axios.get(checkUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      console.log(`✅ GCS bucket exists: ${bucketName}`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        try {
          console.log(`🏗️ Creating GCS bucket: ${bucketName}`);
          const createUrl = `https://storage.googleapis.com/storage/v1/b?project=${this.projectId}`;
          await axios.post(createUrl, {
            name: bucketName,
            location: 'US',
            storageClass: 'STANDARD'
          }, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`✅ GCS bucket created: ${bucketName}`);
        } catch (createError) {
          throw new Error(`Cannot create GCS bucket: ${createError.message}`);
        }
      } else {
        throw error;
      }
    }
  }

  // Check status of all videos in batch
  async checkAllVideosStatus(batchResults) {
    console.log(`\n🔍 CHECKING STATUS OF ALL VIDEOS`);
    console.log('═══════════════════════════════════════');
    
    const statusUpdates = [];
    const googleStorageUrls = [];
    let allCompleted = true;
    
    for (const result of batchResults) {
      if (result.status === 'generating' && result.operationId) {
        console.log(`\n🎥 Checking Scene ${result.sceneNumber}: ${result.title}`);
        
        const status = await this.checkVideoStatus(result.operationId);
        
        const updatedResult = {
          ...result,
          ...status,
          lastChecked: new Date().toISOString()
        };
        
        // Process video data if completed
        if (status.status === 'completed' && status.videoData) {
          try {
            console.log(`🎬 Processing completed video: ${result.title}`);
            const processedVideo = await this.processVideoData(status.videoData, result.videoId);
            updatedResult.localFile = processedVideo;
            updatedResult.downloadedAt = new Date().toISOString();
            
            // Add to Google Storage URLs
            if (processedVideo.publicUrl) {
              googleStorageUrls.push(processedVideo.publicUrl);
            }
            
          } catch (error) {
            updatedResult.downloadError = error.message;
            console.error(`❌ Video processing failed: ${error.message}`);
          }
        }
        
        if (status.status !== 'completed') {
          allCompleted = false;
        }
        
        statusUpdates.push(updatedResult);
      } else {
        statusUpdates.push(result);
      }
    }
    
    // Summary
    const completed = statusUpdates.filter(r => r.status === 'completed').length;
    const failed = statusUpdates.filter(r => r.status === 'failed').length;
    const generating = statusUpdates.filter(r => r.status === 'generating').length;
    
    console.log(`\n📊 BATCH STATUS SUMMARY`);
    console.log(`   ✅ Completed: ${completed}`);
    console.log(`   ⏳ Generating: ${generating}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Local storage: ${this.outputDir}`);
    console.log(`   ☁️ Cloud storage: gs://${this.bucketName}/veo3-videos/`);
    
    // Google Storage URLs for Creatomate
    if (googleStorageUrls.length > 0) {
      console.log(`\n🎨 GOOGLE STORAGE URLS FOR CREATOMATE:`);
      googleStorageUrls.forEach((url, index) => {
        console.log(`Scene ${index + 1}: ${url}`);
      });
    }
    
    return {
      statusUpdates,
      summary: { completed, failed, generating },
      allCompleted,
      hasFailures: failed > 0,
      googleStorageUrls: googleStorageUrls,
      readyForCreatomate: googleStorageUrls.length >= 2
    };
  }

  // Get Google Cloud access token
  async getAccessToken() {
    try {
      const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
      return token;
    } catch (error) {
      throw new Error(`Failed to get access token. Run: gcloud auth login`);
    }
  }

  // Check if authenticated
  async checkAuthentication() {
    try {
      execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { encoding: 'utf8' });
    } catch (error) {
      throw new Error('Not authenticated. Run: gcloud auth login');
    }
  }

  // Helper functions
  generateBatchId() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    return `veo3_${timestamp}_${random}`;
  }

  extractOperationId(response) {
    if (response.name) {
      return response.name;
    }
    throw new Error('No operation ID found in response');
  }

  extractProgress(result) {
    return result.metadata?.progressPercentage || 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // List generated videos
  listGeneratedVideos() {
    console.log(`\n📹 GENERATED VIDEOS`);
    console.log('═══════════════════════════════');
    
    if (!fs.existsSync(this.outputDir)) {
      console.log('📭 No videos directory found');
      return [];
    }
    
    const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.mp4'));
    
    if (files.length === 0) {
      console.log('📭 No videos found');
      return [];
    }
    
    const videos = files.map(file => {
      const filePath = path.join(this.outputDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`🎥 ${file} (${sizeMB}MB) - ${stats.mtime.toISOString()}`);
      
      return {
        fileName: file,
        filePath,
        size: stats.size,
        sizeMB: parseFloat(sizeMB),
        createdAt: stats.mtime.toISOString(),
        videoId: path.basename(file, '.mp4')
      };
    });
    
    console.log(`\n📊 Total: ${videos.length} videos`);
    return videos;
  }

  // Test function
  async runTest() {
    console.log(`\n🧪 RUNNING VEO3 GENERATOR TEST`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      await this.checkAuthentication();
      console.log('✅ Google Cloud authentication OK');
      
      const testPrompt = {
        sceneNumber: 1,
        title: 'Test Scene',
        prompt: 'Professional business person walking in modern office, confident posture, 8 seconds, cinematic lighting'
      };
      
      console.log('🎬 Testing video generation...');
      const result = await this.generateSingleVideo(testPrompt, { durationSeconds: 8 });
      
      if (result.status === 'generating') {
        console.log('✅ Generator test passed');
        console.log(`📋 Operation ID: ${result.operationId}`);
        return result;
      } else {
        throw new Error('Test generation failed to start');
      }
      
    } catch (error) {
      console.error(`❌ Generator test failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = VEO3Generator;