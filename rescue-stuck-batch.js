// rescue-stuck-batch.js - Rescue your stuck VEO3 batch
const { execSync } = require('child_process');
const axios = require('axios');

async function rescueStuckBatch() {
  console.log('\n🆘 RESCUING YOUR STUCK VEO3 BATCH');
  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 Batch ID: veo3_fixed_92832803_1nor');
  console.log('📡 Problem: Endless GET requests with no video data found');
  console.log('🔧 Solution: Manual operation check with FIXED API calls');
  
  // Get your server's active batches by checking memory or logs
  const batchId = 'veo3_fixed_92832803_1nor';
  
  console.log(`\n📋 STEP 1: Getting Google Cloud access token...`);
  let accessToken;
  try {
    accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    console.log(`✅ Access token obtained: ${accessToken.substring(0, 20)}...`);
  } catch (error) {
    console.error(`❌ Failed to get access token: ${error.message}`);
    console.log(`🔧 Run: gcloud auth login`);
    return;
  }
  
  // Your project details (from the server logs)
  const projectId = 'veo3-system-shannon-2024'; // or your actual project
  const location = 'us-central1';
  const apiEndpoint = `${location}-aiplatform.googleapis.com`;
  
  console.log(`\n📋 STEP 2: Checking recent VEO3 operations...`);
  console.log(`🔍 Project: ${projectId}`);
  console.log(`🌍 Location: ${location}`);
  
  try {
    // List recent operations to find yours
    const listUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${location}/operations`;
    
    console.log(`📡 Calling: ${listUrl}`);
    
    const listResponse = await axios.get(listUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`📊 Found ${listResponse.data.operations?.length || 0} operations`);
    
    if (!listResponse.data.operations || listResponse.data.operations.length === 0) {
      console.log(`❌ No operations found. They may have expired (48h limit).`);
      console.log(`💡 Generate new videos instead.`);
      return;
    }
    
    // Filter VEO3 operations from the last few hours
    const veo3Operations = listResponse.data.operations.filter(op => 
      op.name.includes('veo-3.0-fast-generate-preview') ||
      op.name.includes('veo-3.0-generate-preview')
    );
    
    console.log(`🎬 Found ${veo3Operations.length} VEO3 operations`);
    
    if (veo3Operations.length === 0) {
      console.log(`❌ No VEO3 operations found.`);
      console.log(`💡 Your videos may have expired or completed elsewhere.`);
      return;
    }
    
    console.log(`\n📋 STEP 3: Checking each VEO3 operation...`);
    
    const completedVideos = [];
    
    for (let i = 0; i < Math.min(veo3Operations.length, 5); i++) {
      const operation = veo3Operations[i];
      const operationId = operation.name;
      const shortId = operationId.split('/').pop().substring(0, 8);
      
      console.log(`\n🎥 Operation ${i + 1}: ...${shortId}`);
      console.log(`⏰ Created: ${operation.metadata?.createTime || 'Unknown'}`);
      
      try {
        // Use FIXED status check (GET instead of POST)
        const statusUrl = `https://${apiEndpoint}/v1/${operationId}`;
        
        const statusResponse = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        
        const result = statusResponse.data;
        console.log(`📊 Status: done=${result.done}`);
        
        if (result.done === true) {
          if (result.error) {
            console.log(`❌ Failed: ${result.error.message}`);
          } else {
            console.log(`✅ COMPLETED! Extracting video data...`);
            
            // Try to extract video data using multiple methods
            const videoData = extractVideoDataMultipleMethods(result);
            
            if (videoData) {
              console.log(`🎉 VIDEO DATA FOUND!`);
              console.log(`📊 Type: ${videoData.type}`);
              console.log(`📄 Source: ${videoData.sourceProperty}`);
              
              if (videoData.type === 'base64') {
                console.log(`💾 Size: ${(videoData.data.length / 1024).toFixed(1)}KB`);
                
                // Save this video
                const videoFile = await saveVideoQuick(videoData.data, `rescued_video_${i + 1}_${Date.now()}`);
                completedVideos.push({
                  operationId: shortId,
                  file: videoFile,
                  extractedWith: videoData.sourceProperty
                });
                
                console.log(`💾 Saved: ${videoFile.fileName}`);
              }
            } else {
              console.log(`❌ No video data found in completed operation`);
              // Log the structure for debugging
              console.log(`📋 Response keys: ${Object.keys(result).join(', ')}`);
              if (result.response) {
                console.log(`📋 Response.response keys: ${Object.keys(result.response).join(', ')}`);
              }
            }
          }
        } else {
          console.log(`⏳ Still generating...`);
        }
        
      } catch (error) {
        console.error(`❌ Error checking operation: ${error.message}`);
      }
      
      // Wait between checks
      if (i < veo3Operations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`\n🎉 RESCUE OPERATION COMPLETE!`);
    console.log(`📹 Rescued videos: ${completedVideos.length}`);
    
    if (completedVideos.length > 0) {
      console.log(`\n🎬 RESCUED VIDEOS:`);
      completedVideos.forEach(video => {
        console.log(`   📁 ${video.file.fileName} (${video.file.sizeMB}MB)`);
        console.log(`   🔍 Found in: ${video.extractedWith}`);
        console.log(`   📍 Location: ${video.file.filePath}`);
      });
      
      console.log(`\n💡 NEXT STEPS:`);
      console.log(`   1. Your videos are saved in ./generated-videos/`);
      console.log(`   2. Replace your VEO3Generator.js with the FIXED version`);
      console.log(`   3. Restart your server to stop the endless GET requests`);
      console.log(`   4. Generate new videos will now work correctly`);
      
      return completedVideos;
    } else {
      console.log(`\n⚠️ NO VIDEOS RESCUED`);
      console.log(`   Possible reasons:`);
      console.log(`   1. Videos are still generating (wait longer)`);
      console.log(`   2. Operations have expired (48h limit)`);
      console.log(`   3. Videos failed generation`);
      console.log(`   4. Different project ID or location`);
      
      console.log(`\n🔧 TROUBLESHOOTING:`);
      console.log(`   1. Check if videos are still generating: wait 10+ minutes`);
      console.log(`   2. Verify project ID: gcloud config get-value project`);
      console.log(`   3. Generate fresh videos with FIXED VEO3Generator`);
    }
    
  } catch (error) {
    console.error(`❌ Rescue operation failed: ${error.message}`);
    
    if (error.response) {
      console.log(`📡 HTTP Status: ${error.response.status}`);
      console.log(`📡 Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log(`\n🔧 ALTERNATIVE SOLUTION:`);
    console.log(`   1. Stop your current server (Ctrl+C)`);
    console.log(`   2. Replace VEO3Generator.js with FIXED version`);
    console.log(`   3. Generate new videos (they will work correctly)`);
    console.log(`   4. Old stuck videos can be considered lost (regenerate)`);
  }
}

// Multiple video extraction methods (same as FIXED VEO3Generator)
function extractVideoDataMultipleMethods(result) {
  console.log(`🔍 Extracting video data with multiple methods...`);
  
  // Method 1: Standard predictions path
  if (result.response && result.response.predictions && result.response.predictions.length > 0) {
    const prediction = result.response.predictions[0];
    console.log(`📄 Method 1: Checking prediction keys: ${Object.keys(prediction).join(', ')}`);
    
    const videoProps = ['generatedVideo', 'videoBytes', 'bytesBase64Encoded', 'content', 'data', 'video'];
    for (const prop of videoProps) {
      if (prediction[prop] && typeof prediction[prop] === 'string' && prediction[prop].length > 50000) {
        console.log(`✅ Method 1: Found video in ${prop}`);
        return {
          type: 'base64',
          data: prediction[prop],
          sourceProperty: `response.predictions[0].${prop}`
        };
      }
    }
  }
  
  // Method 2: Deep scan
  const deepResult = deepScanObject(result, '');
  if (deepResult) {
    console.log(`✅ Method 2: Found video in deep scan`);
    return deepResult;
  }
  
  console.log(`❌ No video data found with any method`);
  return null;
}

// Deep scan helper
function deepScanObject(obj, path, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth || typeof obj !== 'object' || obj === null) return null;
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (typeof value === 'string' && value.length > 50000) {
      // Check if it looks like base64 video
      const cleanValue = value.replace(/^data:.*?;base64,/, '');
      if (cleanValue.length > 50000 && /^[A-Za-z0-9+/]*={0,2}$/.test(cleanValue) && cleanValue.length % 4 === 0) {
        console.log(`🎯 Deep scan: Found video at ${currentPath}`);
        return {
          type: 'base64',
          data: value,
          sourceProperty: currentPath
        };
      }
    }
    
    if (typeof value === 'object' && value !== null) {
      const nestedResult = deepScanObject(value, currentPath, maxDepth, currentDepth + 1);
      if (nestedResult) return nestedResult;
    }
  }
  
  return null;
}

// Quick save function
async function saveVideoQuick(base64Data, videoId) {
  const fs = require('fs');
  const path = require('path');
  
  const outputDir = './generated-videos';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '').replace(/\s/g, '');
  const binaryData = Buffer.from(cleanBase64, 'base64');
  
  const fileName = `${videoId}.mp4`;
  const filePath = path.join(outputDir, fileName);
  
  fs.writeFileSync(filePath, binaryData);
  
  return {
    fileName,
    filePath,
    sizeMB: (binaryData.length / 1024 / 1024).toFixed(1)
  };
}

// Run the rescue
if (require.main === module) {
  rescueStuckBatch().catch(error => {
    console.error('Rescue failed:', error.message);
    process.exit(1);
  });
}

module.exports = { rescueStuckBatch };