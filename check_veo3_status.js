// check_veo3_status.js - FIXED VERSION
const VEO3Generator = require('./modules/VEO3Generator');

async function checkCurrentGeneration() {
  console.log('\n🔍 CHECKING YOUR CURRENT VEO3 GENERATION (FIXED)');
  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 VEO3 FAST + Fixed Response Parsing + Google Storage + Creatomate!');
  
  const generator = new VEO3Generator();
  
  // Je operation IDs uit de output:
  const operationIds = [
    'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/f45ce2bd-b1ad-4b5e-885e-8f7b8bfdfaba',
    'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/1fb34103-7886-4dd8-9785-230bd48dd417',
    'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/63fd7890-8301-46e5-a685-406dd0325983'
  ];
  
  const sceneNames = [
    'Revolutionaire Ontdekking bij Beautyville',
    'Wonderbehandeling bij Beautyville', 
    'Superman Straalt bij Beautyville'
  ];
  
  console.log(`📹 Checking ${operationIds.length} videos with FIXED parsing...`);
  console.log(`🎭 Character: Dr. Lena Carter (Dutch healthcare expert)`);
  console.log(`⏱️ Duration: 8 seconds each`);
  console.log(`💰 Total cost: $3.60 (VEO3 Fast)`);
  console.log(`☁️ Storage: Google Cloud Storage (for Creatomate)`);
  console.log(`🔧 Fix: Improved response parsing with 4 fallback methods`);
  
  const completedVideos = [];
  const googleStorageUrls = [];
  let allCompleted = true;
  
  for (let i = 0; i < operationIds.length; i++) {
    const operationId = operationIds[i];
    const sceneName = sceneNames[i];
    const sceneNumber = i + 1;
    
    console.log(`\n🎬 Scene ${sceneNumber}: ${sceneName}`);
    console.log(`🔍 Operation: ...${operationId.split('/').pop().substring(0, 8)}`);
    
    try {
      const status = await generator.checkVideoStatus(operationId);
      
      if (status.status === 'completed' && status.videoData) {
        console.log(`✅ COMPLETED! Processing with FIXED parser...`);
        console.log(`📊 Video data type: ${status.videoData.type}`);
        console.log(`📄 Source property: ${status.videoData.sourceProperty}`);
        
        if (status.videoData.type === 'base64') {
          console.log(`💾 Base64 size: ${(status.videoData.data.length / 1024).toFixed(1)}KB`);
        }
        
        const videoId = `beautyville_dr_lena_scene_${sceneNumber}`;
        const processedVideo = await generator.processVideoData(status.videoData, videoId);
        
        console.log(`\n🎉 VIDEO READY:`);
        console.log(`   📱 Public URL: ${processedVideo.publicUrl}`);
        console.log(`   ☁️ Storage URL: ${processedVideo.storageUrl}`);
        console.log(`   📦 GCS Bucket: ${processedVideo.bucketName}/${processedVideo.gcsFileName}`);
        console.log(`   📏 Size: ${processedVideo.sizeMB}MB`);
        console.log(`   🎭 Source: ${processedVideo.source}`);
        console.log(`   📁 Local file: ${processedVideo.localFilePath}`);
        console.log(`   🎨 Creatomate Ready: ${processedVideo.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
        
        // Add to arrays for Creatomate
        completedVideos.push({
          sceneNumber,
          title: sceneName,
          ...processedVideo
        });
        
        if (processedVideo.publicUrl && processedVideo.publicUrl.includes('storage.googleapis.com')) {
          googleStorageUrls.push(processedVideo.publicUrl);
          console.log(`   ✅ Google Storage URL ready for Creatomate`);
        } else {
          console.log(`   ⚠️ Warning: Not a Google Storage URL`);
        }
        
      } else if (status.status === 'generating') {
        console.log(`⏳ Still generating... (${status.progress || 'unknown'}% done)`);
        console.log(`💡 VEO3 Fast typically takes 3-8 minutes per video`);
        allCompleted = false;
        
      } else if (status.status === 'expired') {
        console.log(`⏰ Operation expired (VEO3 operations expire after 48h)`);
        console.log(`💡 You'll need to regenerate this scene`);
        allCompleted = false;
        
      } else if (status.status === 'failed') {
        console.log(`❌ Failed: ${status.error}`);
        console.log(`🔄 You can retry this scene if needed`);
        allCompleted = false;
        
      } else {
        console.log(`🔄 Status: ${status.status}`);
        if (status.error) {
          console.log(`⚠️ Error: ${status.error}`);
        }
        allCompleted = false;
      }
      
    } catch (error) {
      console.error(`❌ Error checking scene ${sceneNumber}: ${error.message}`);
      allCompleted = false;
    }
    
    // Wait between checks to avoid rate limiting
    if (i < operationIds.length - 1) {
      console.log(`⏳ Waiting 3 seconds before next check...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Final summary
  console.log(`\n📊 FINAL STATUS SUMMARY`);
  console.log('═══════════════════════════════════════');
  console.log(`✅ Completed videos: ${completedVideos.length}/${operationIds.length}`);
  console.log(`📁 Videos saved to: ./generated-videos/`);
  console.log(`☁️ Google Storage URLs: ${googleStorageUrls.length}/${operationIds.length}`);
  console.log(`🔧 Using FIXED response parsing: ✅`);
  
  if (completedVideos.length > 0) {
    console.log(`\n🎬 READY TO WATCH:`);
    completedVideos.forEach(video => {
      console.log(`📹 Scene ${video.sceneNumber}: ${video.title}`);
      console.log(`   🔗 URL: ${video.publicUrl}`);
      console.log(`   📏 Size: ${video.sizeMB}MB`);
      console.log(`   ☁️ GCS: ${video.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
      console.log(`   📁 Local: ${video.fileName}`);
    });
    
    if (googleStorageUrls.length > 0) {
      console.log(`\n🎨 GOOGLE STORAGE URLS FOR CREATOMATE:`);
      googleStorageUrls.forEach((url, index) => {
        console.log(`Scene ${index + 1}: ${url}`);
      });
      
      if (googleStorageUrls.length >= 2) {
        console.log(`\n🎞️ READY FOR CREATOMATE EDITING!`);
        console.log(`💡 Next step: Use CreatomateEditor with these Google Storage URLs`);
        console.log(`🚀 Example:`);
        console.log(`   const CreatomateEditor = require('./modules/CreatomateEditor');`);
        console.log(`   const editor = new CreatomateEditor();`);
        console.log(`   const googleUrls = [`);
        googleStorageUrls.forEach((url, index) => {
          console.log(`     "${url}"${index < googleStorageUrls.length - 1 ? ',' : ''}`);
        });
        console.log(`   ];`);
        console.log(`   await editor.editVideos(googleUrls);`);
        
        if (googleStorageUrls.length === 3) {
          console.log(`\n🎊 ALL 3 SCENES READY FOR 3-SCENE TEMPLATE!`);
        } else if (googleStorageUrls.length === 2) {
          console.log(`\n🎬 2 SCENES READY FOR 2-SCENE TEMPLATE!`);
        }
      }
    }
  }
  
  if (!allCompleted) {
    console.log(`\n⏳ Some videos still generating or failed...`);
    console.log(`🔄 Re-run this script in a few minutes:`);
    console.log(`   node check_veo3_status.js`);
    console.log(`🔧 FIXED: Better error handling and response parsing`);
  }
  
  console.log(`\n✅ Status check completed with FIXED parsing!`);
  return { 
    completedVideos, 
    allCompleted, 
    googleStorageUrls,
    readyForCreatomate: googleStorageUrls.length >= 2
  };
}

// Additional function to check any operation ID
async function checkSingleOperation(operationId) {
  console.log(`\n🔍 Checking single operation (FIXED): ${operationId}`);
  
  const generator = new VEO3Generator();
  
  try {
    const status = await generator.checkVideoStatus(operationId);
    
    console.log(`📊 Status: ${status.status}`);
    if (status.error) {
      console.log(`❌ Error: ${status.error}`);
    }
    if (status.progress) {
      console.log(`📈 Progress: ${status.progress}%`);
    }
    if (status.videoData) {
      console.log(`🎬 Video data type: ${status.videoData.type}`);
      console.log(`📄 Source property: ${status.videoData.sourceProperty}`);
      
      if (status.status === 'completed') {
        const videoId = `single_check_${Date.now()}`;
        const processedVideo = await generator.processVideoData(status.videoData, videoId);
        
        console.log(`🎉 VIDEO PROCESSED WITH FIXED PARSER:`);
        console.log(`   📱 Public URL: ${processedVideo.publicUrl}`);
        console.log(`   ☁️ Storage URL: ${processedVideo.storageUrl}`);
        console.log(`   📏 Size: ${processedVideo.sizeMB}MB`);
        console.log(`   🌐 Google Storage: ${processedVideo.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
        console.log(`   📁 Local file: ${processedVideo.localFilePath}`);
      }
    }
    
    return status;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  }
}

// Function to test Creatomate with completed videos
async function testCreatomateIntegration() {
  console.log(`\n🎨 TESTING CREATOMATE INTEGRATION (FIXED)`);
  console.log('═══════════════════════════════════════');
  
  try {
    const CreatomateEditor = require('./modules/CreatomateEditor');
    const editor = new CreatomateEditor();
    
    // Check for completed videos
    const result = await checkCurrentGeneration();
    
    if (result.readyForCreatomate) {
      console.log(`\n🚀 Starting Creatomate editing with Google Storage URLs...`);
      console.log(`📹 Using ${result.googleStorageUrls.length} videos`);
      
      const editResult = await editor.editVideos(result.googleStorageUrls);
      
      console.log(`✅ Creatomate editing started!`);
      console.log(`📋 Job ID: ${editResult.jobId}`);
      console.log(`🎬 Render ID: ${editResult.renderJob.id}`);
      console.log(`🌐 Google Storage URLs used: ${editResult.googleStorageUrls.length}`);
      console.log(`🎨 Template: ${editResult.templateType}`);
      
      return editResult;
    } else {
      console.log(`⚠️ Not all videos ready for Creatomate yet`);
      console.log(`   Completed: ${result.completedVideos.length}/${operationIds.length}`);
      console.log(`   Google Storage URLs: ${result.googleStorageUrls.length}/${operationIds.length}`);
      console.log(`   Need at least 2 videos for Creatomate editing`);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Creatomate integration test failed: ${error.message}`);
    throw error;
  }
}

// Function to batch check and automatically start Creatomate
async function autoProcessPipeline() {
  console.log(`\n🔄 AUTOMATED PROCESSING PIPELINE (FIXED)`);
  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 Check videos → Upload to GCS → Start Creatomate editing');
  
  try {
    // Step 1: Check video status
    console.log(`\n📋 STEP 1: Checking video generation status...`);
    const result = await checkCurrentGeneration();
    
    // Step 2: Auto-start Creatomate if ready
    if (result.readyForCreatomate && result.googleStorageUrls.length >= 2) {
      console.log(`\n📋 STEP 2: Auto-starting Creatomate editing...`);
      const editResult = await testCreatomateIntegration();
      
      if (editResult) {
        console.log(`\n✅ AUTOMATED PIPELINE COMPLETED!`);
        console.log(`🎬 Videos: ${result.completedVideos.length} ready`);
        console.log(`🎨 Creatomate: ${editResult.jobId} started`);
        console.log(`⏱️ Estimated editing time: ${editResult.estimatedTime}`);
        
        return {
          videos: result.completedVideos,
          googleStorageUrls: result.googleStorageUrls,
          creatomateJob: editResult
        };
      }
    } else {
      console.log(`\n⏳ PIPELINE WAITING...`);
      console.log(`   Videos completed: ${result.completedVideos.length}/${operationIds.length}`);
      console.log(`   Google Storage URLs: ${result.googleStorageUrls.length}/${operationIds.length}`);
      console.log(`   Minimum needed: 2 videos for editing`);
      console.log(`\n💡 Run again when more videos are ready`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Automated pipeline failed: ${error.message}`);
    throw error;
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length > 0 && args[0].startsWith('projects/')) {
  // Check single operation ID
  const operationId = args[0];
  checkSingleOperation(operationId).catch(error => {
    console.error('Single operation check failed:', error.message);
    process.exit(1);
  });
} else if (args.includes('--creatomate')) {
  // Test Creatomate integration
  testCreatomateIntegration().catch(error => {
    console.error('Creatomate integration failed:', error.message);
    process.exit(1);
  });
} else if (args.includes('--auto')) {
  // Run automated pipeline
  autoProcessPipeline().catch(error => {
    console.error('Automated pipeline failed:', error.message);
    process.exit(1);
  });
} else if (args.includes('--help')) {
  console.log(`\n🔍 VEO3 STATUS CHECKER (FIXED + Google Storage + Creatomate)`);
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n💡 USAGE:`);
  console.log(`   node check_veo3_status.js                    # Check your Beautyville scenes (FIXED)`);
  console.log(`   node check_veo3_status.js [operation-id]     # Check single operation`);
  console.log(`   node check_veo3_status.js --creatomate       # Test Creatomate integration`);
  console.log(`   node check_veo3_status.js --auto             # Automated pipeline (check + edit)`);
  console.log(`   node check_veo3_status.js --help             # Show this help`);
  console.log(`\n🎯 This script checks your 3 Beautyville healthcare scenes:`);
  console.log(`   1. Revolutionaire Ontdekking bij Beautyville`);
  console.log(`   2. Wonderbehandeling bij Beautyville`);
  console.log(`   3. Superman Straalt bij Beautyville`);
  console.log(`\n🔧 FIXED FEATURES:`);
  console.log(`   ✅ FIXED response parsing (4 fallback methods)`);
  console.log(`   ✅ Better error handling for expired operations`);
  console.log(`   ✅ VEO3 Fast (5x cheaper than VEO3)`);
  console.log(`   ✅ Base64 → MP4 conversion`);
  console.log(`   ✅ Google Cloud Storage upload`);
  console.log(`   ✅ Public URLs for Creatomate`);
  console.log(`   ✅ Automatic Creatomate integration`);
  console.log(`   ✅ Enhanced logging and debugging`);
  console.log(`\n🎨 CREATOMATE AUTOMATION:`);
  console.log(`   --auto flag: Automatically starts Creatomate editing when 2+ videos ready`);
  console.log(`   --creatomate flag: Manual Creatomate integration test`);
  console.log(`\n💰 COST BREAKDOWN:`);
  console.log(`   VEO3 Fast: $1.20 per 8-second video`);
  console.log(`   3 videos: $3.60 total`);
  console.log(`   Creatomate: ~$0.50 per minute of output`);
} else {
  // Run the main check for your Beautyville scenes
  checkCurrentGeneration().catch(error => {
    console.error('Status check failed:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   - Make sure you have gcloud auth login');
    console.log('   - Check your internet connection');
    console.log('   - Verify operation IDs are correct');
    console.log('   - Ensure Google Cloud Storage permissions');
    console.log('   🔧 FIXED: Better error handling in this version');
    process.exit(1);
  });
}