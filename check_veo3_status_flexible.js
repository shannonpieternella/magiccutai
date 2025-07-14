// check_veo3_status_flexible.js - FLEXIBLE VERSION (No hard-coded IDs)
const VEO3Generator = require('./modules/VEO3Generator');
const fs = require('fs');
const path = require('path');

// Flexible status checker that can work with any operation IDs
class FlexibleVEO3StatusChecker {
  constructor() {
    this.generator = new VEO3Generator();
    this.operationIds = [];
    this.sceneNames = [];
  }

  // Load operation IDs from various sources
  async loadOperationIds(source = 'auto') {
    console.log(`🔍 Loading operation IDs from: ${source}`);
    
    switch (source) {
      case 'auto':
        return await this.autoDetectOperationIds();
      case 'file':
        return await this.loadFromFile();
      case 'server':
        return await this.loadFromServer();
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  // Auto-detect from multiple sources
  async autoDetectOperationIds() {
    console.log('🔍 AUTO-DETECTING operation IDs...');
    
    // Try server first
    try {
      const serverIds = await this.loadFromServer();
      if (serverIds.length > 0) {
        console.log(`✅ Found ${serverIds.length} operation IDs from server`);
        return serverIds;
      }
    } catch (error) {
      console.log('⚠️ Server not available, trying other methods...');
    }

    // Try file
    try {
      const fileIds = await this.loadFromFile();
      if (fileIds.length > 0) {
        console.log(`✅ Found ${fileIds.length} operation IDs from file`);
        return fileIds;
      }
    } catch (error) {
      console.log('⚠️ No operation file found, using fallback...');
    }

    // Fallback to your specific IDs (if available)
    return this.getFallbackOperationIds();
  }

  // Load from running server's active batches
  async loadFromServer() {
    try {
      console.log('🌐 Checking server for active batches...');
      
      const response = await fetch('http://localhost:3000/api/health');
      if (!response.ok) throw new Error('Server not responding');

      // Try to get active batches (if endpoint exists)
      try {
        const batchResponse = await fetch('http://localhost:3000/api/active-batches');
        if (batchResponse.ok) {
          const batches = await batchResponse.json();
          
          const operationIds = [];
          const sceneNames = [];
          
          if (batches.success && batches.batches) {
            batches.batches.forEach(batch => {
              if (batch.results) {
                batch.results.forEach((result, index) => {
                  operationIds.push(result.operationId);
                  sceneNames.push(result.title || `Scene ${index + 1}`);
                });
              }
            });
          }
          
          this.operationIds = operationIds;
          this.sceneNames = sceneNames;
          return operationIds;
        }
      } catch (error) {
        console.log('⚠️ No active batches endpoint available');
      }

      return [];
    } catch (error) {
      throw new Error(`Server not available: ${error.message}`);
    }
  }

  // Load from file (operations.json)
  async loadFromFile() {
    const possibleFiles = [
      './operations.json',
      './veo3_operations.json',
      './last_generation.json',
      './generated-videos/operations.json'
    ];

    for (const filename of possibleFiles) {
      try {
        if (fs.existsSync(filename)) {
          console.log(`📁 Reading operation IDs from: ${filename}`);
          
          const fileContent = fs.readFileSync(filename, 'utf8');
          const data = JSON.parse(fileContent);
          
          let operationIds = [];
          let sceneNames = [];
          
          // Handle different file formats
          if (data.operationIds) {
            operationIds = data.operationIds;
            sceneNames = data.sceneNames || operationIds.map((_, i) => `Scene ${i + 1}`);
          } else if (data.results) {
            operationIds = data.results.map(r => r.operationId);
            sceneNames = data.results.map(r => r.title || r.scene || `Scene ${operationIds.indexOf(r.operationId) + 1}`);
          } else if (Array.isArray(data)) {
            operationIds = data;
            sceneNames = data.map((_, i) => `Scene ${i + 1}`);
          }
          
          if (operationIds.length > 0) {
            this.operationIds = operationIds;
            this.sceneNames = sceneNames;
            return operationIds;
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not read ${filename}: ${error.message}`);
      }
    }
    
    return [];
  }

  // Fallback operation IDs (your specific ones if needed)
  getFallbackOperationIds() {
    console.log('🔄 Using fallback operation IDs (update these with your latest)');
    
    const fallbackIds = [
      'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/f45ce2bd-b1ad-4b5e-885e-8f7b8bfdfaba',
      'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/1fb34103-7886-4dd8-9785-230bd48dd417',
      'projects/veo3-system-shannon-2024/locations/us-central1/publishers/google/models/veo-3.0-fast-generate-preview/operations/63fd7890-8301-46e5-a685-406dd0325983'
    ];
    
    const fallbackNames = [
      'Fallback Scene 1',
      'Fallback Scene 2', 
      'Fallback Scene 3'
    ];
    
    this.operationIds = fallbackIds;
    this.sceneNames = fallbackNames;
    
    console.log('⚠️ Using fallback IDs - these may be expired!');
    console.log('💡 To use your current IDs:');
    console.log('   1. Save operation IDs to operations.json');
    console.log('   2. Or run this while server is active');
    console.log('   3. Or pass operation IDs as arguments');
    
    return fallbackIds;
  }

  // Save current operation IDs for future use
  saveOperationIds(operationIds, sceneNames = null, filename = './operations.json') {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        operationIds: operationIds,
        sceneNames: sceneNames || operationIds.map((_, i) => `Scene ${i + 1}`),
        source: 'veo3_status_checker'
      };
      
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`💾 Saved operation IDs to: ${filename}`);
    } catch (error) {
      console.error(`❌ Could not save operation IDs: ${error.message}`);
    }
  }

  // Main status checking function
  async checkStatus(source = 'auto') {
    console.log('\n🔍 FLEXIBLE VEO3 STATUS CHECKER');
    console.log('═══════════════════════════════════════');
    console.log('🎯 Flexible operation ID detection + Google Storage + Creatomate!');
    
    try {
      // Load operation IDs
      const operationIds = await this.loadOperationIds(source);
      
      if (operationIds.length === 0) {
        console.log('\n❌ NO OPERATION IDs FOUND!');
        console.log('💡 Options:');
        console.log('   1. Start a new video generation');
        console.log('   2. Create operations.json with your IDs');
        console.log('   3. Pass operation IDs as arguments');
        console.log('   4. Make sure server is running');
        return { completedVideos: [], allCompleted: false, googleStorageUrls: [] };
      }
      
      console.log(`\n📹 Checking ${operationIds.length} videos...`);
      console.log(`🔄 Source: ${source}`);
      console.log(`⏱️ Duration: 8 seconds each (estimated)`);
      console.log(`💰 Estimated cost: $${(operationIds.length * 1.20).toFixed(2)} (VEO3 Fast)`);
      console.log(`☁️ Storage: Google Cloud Storage (for Creatomate)`);
      
      const completedVideos = [];
      const googleStorageUrls = [];
      let allCompleted = true;
      
      for (let i = 0; i < operationIds.length; i++) {
        const operationId = operationIds[i];
        const sceneName = this.sceneNames[i] || `Scene ${i + 1}`;
        const sceneNumber = i + 1;
        
        console.log(`\n🎬 Scene ${sceneNumber}: ${sceneName}`);
        console.log(`🔍 Operation: ...${operationId.split('/').pop().substring(0, 8)}`);
        
        try {
          const status = await this.generator.checkVideoStatus(operationId);
          
          if (status.status === 'completed' && status.videoData) {
            console.log(`✅ COMPLETED! Processing...`);
            console.log(`📊 Video data type: ${status.videoData.type}`);
            
            const videoId = `flexible_scene_${sceneNumber}_${Date.now()}`;
            const processedVideo = await this.generator.processVideoData(status.videoData, videoId);
            
            console.log(`\n🎉 VIDEO READY:`);
            console.log(`   📱 Public URL: ${processedVideo.publicUrl}`);
            console.log(`   ☁️ Storage URL: ${processedVideo.storageUrl || 'Processing...'}`);
            console.log(`   📏 Size: ${processedVideo.sizeMB}MB`);
            console.log(`   🎨 Creatomate Ready: ${processedVideo.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
            
            completedVideos.push({
              sceneNumber,
              title: sceneName,
              operationId,
              ...processedVideo
            });
            
            if (processedVideo.publicUrl && processedVideo.publicUrl.includes('storage.googleapis.com')) {
              googleStorageUrls.push(processedVideo.publicUrl);
              console.log(`   ✅ Google Storage URL ready for Creatomate`);
            }
            
          } else if (status.status === 'generating') {
            console.log(`⏳ Still generating... (${status.progress || 'unknown'}% done)`);
            allCompleted = false;
            
          } else if (status.status === 'expired') {
            console.log(`⏰ Operation expired (VEO3 operations expire after 48h)`);
            allCompleted = false;
            
          } else if (status.status === 'failed') {
            console.log(`❌ Failed: ${status.error}`);
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
        
        // Wait between checks
        if (i < operationIds.length - 1) {
          console.log(`⏳ Waiting 3 seconds before next check...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Save operation IDs for future use
      this.saveOperationIds(operationIds, this.sceneNames);
      
      // Final summary
      console.log(`\n📊 FINAL STATUS SUMMARY`);
      console.log('═══════════════════════════════════════');
      console.log(`✅ Completed videos: ${completedVideos.length}/${operationIds.length}`);
      console.log(`📁 Videos saved to: ./generated-videos/`);
      console.log(`☁️ Google Storage URLs: ${googleStorageUrls.length}/${operationIds.length}`);
      console.log(`🔧 Using flexible operation ID detection: ✅`);
      
      if (completedVideos.length > 0) {
        console.log(`\n🎬 READY TO WATCH:`);
        completedVideos.forEach(video => {
          console.log(`📹 Scene ${video.sceneNumber}: ${video.title}`);
          console.log(`   🔗 URL: ${video.publicUrl}`);
          console.log(`   📏 Size: ${video.sizeMB}MB`);
          console.log(`   ☁️ GCS: ${video.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
        });
        
        if (googleStorageUrls.length > 0) {
          console.log(`\n🎨 GOOGLE STORAGE URLS FOR CREATOMATE:`);
          googleStorageUrls.forEach((url, index) => {
            console.log(`Scene ${index + 1}: ${url}`);
          });
          
          if (googleStorageUrls.length >= 2) {
            console.log(`\n🎞️ READY FOR CREATOMATE EDITING!`);
            console.log(`💡 Use these URLs with CreatomateEditor`);
            
            if (googleStorageUrls.length === 3) {
              console.log(`🎊 ALL 3 SCENES READY FOR 3-SCENE TEMPLATE!`);
            } else if (googleStorageUrls.length === 2) {
              console.log(`🎬 2 SCENES READY FOR 2-SCENE TEMPLATE!`);
            }
          }
        }
      }
      
      if (!allCompleted) {
        console.log(`\n⏳ Some videos still generating or failed...`);
        console.log(`🔄 Re-run this script in a few minutes:`);
        console.log(`   node check_veo3_status_flexible.js`);
      }
      
      console.log(`\n✅ Flexible status check completed!`);
      return { 
        completedVideos, 
        allCompleted, 
        googleStorageUrls,
        readyForCreatomate: googleStorageUrls.length >= 2
      };
      
    } catch (error) {
      console.error(`❌ Status check failed: ${error.message}`);
      throw error;
    }
  }

  // Check single operation
  async checkSingleOperation(operationId) {
    console.log(`\n🔍 Checking single operation: ${operationId}`);
    
    try {
      const status = await this.generator.checkVideoStatus(operationId);
      
      console.log(`📊 Status: ${status.status}`);
      if (status.error) {
        console.log(`❌ Error: ${status.error}`);
      }
      if (status.progress) {
        console.log(`📈 Progress: ${status.progress}%`);
      }
      if (status.videoData) {
        console.log(`🎬 Video data type: ${status.videoData.type}`);
        
        if (status.status === 'completed') {
          const videoId = `single_check_${Date.now()}`;
          const processedVideo = await this.generator.processVideoData(status.videoData, videoId);
          
          console.log(`🎉 VIDEO PROCESSED:`);
          console.log(`   📱 Public URL: ${processedVideo.publicUrl}`);
          console.log(`   ☁️ Storage URL: ${processedVideo.storageUrl}`);
          console.log(`   📏 Size: ${processedVideo.sizeMB}MB`);
          console.log(`   🌐 Google Storage: ${processedVideo.publicUrl.includes('storage.googleapis.com') ? '✅' : '❌'}`);
        }
      }
      
      return status;
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  // Auto Creatomate integration
  async autoCreatomate() {
    console.log(`\n🎨 AUTO CREATOMATE INTEGRATION`);
    console.log('═══════════════════════════════════════');
    
    try {
      const result = await this.checkStatus('auto');
      
      if (result.readyForCreatomate) {
        console.log(`\n🚀 Starting Creatomate editing with Google Storage URLs...`);
        
        const CreatomateEditor = require('./modules/CreatomateEditor');
        const editor = new CreatomateEditor();
        
        const editResult = await editor.editVideos(result.googleStorageUrls);
        
        console.log(`✅ Creatomate editing started!`);
        console.log(`📋 Job ID: ${editResult.jobId}`);
        console.log(`🎨 Template: ${editResult.templateType}`);
        
        return editResult;
      } else {
        console.log(`⚠️ Not ready for Creatomate yet`);
        console.log(`   Completed: ${result.completedVideos.length}`);
        console.log(`   Google Storage URLs: ${result.googleStorageUrls.length}`);
        console.log(`   Need at least 2 videos for editing`);
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Auto Creatomate failed: ${error.message}`);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const checker = new FlexibleVEO3StatusChecker();
  
  try {
    if (args.length > 0 && args[0].startsWith('projects/')) {
      // Check single operation ID
      const operationId = args[0];
      await checker.checkSingleOperation(operationId);
      
    } else if (args.includes('--creatomate')) {
      // Auto Creatomate integration
      await checker.autoCreatomate();
      
    } else if (args.includes('--server')) {
      // Force load from server
      await checker.checkStatus('server');
      
    } else if (args.includes('--file')) {
      // Force load from file
      await checker.checkStatus('file');
      
    } else if (args.includes('--help')) {
      console.log(`\n🔍 FLEXIBLE VEO3 STATUS CHECKER`);
      console.log('═══════════════════════════════════════');
      console.log(`\n💡 USAGE:`);
      console.log(`   node check_veo3_status_flexible.js           # Auto-detect operation IDs`);
      console.log(`   node check_veo3_status_flexible.js --server  # Load from running server`);
      console.log(`   node check_veo3_status_flexible.js --file    # Load from operations.json`);
      console.log(`   node check_veo3_status_flexible.js --creatomate # Auto Creatomate`);
      console.log(`   node check_veo3_status_flexible.js [operation-id] # Check single`);
      console.log(`   node check_veo3_status_flexible.js --help    # Show this help`);
      console.log(`\n🎯 FLEXIBLE FEATURES:`);
      console.log(`   ✅ Auto-detects operation IDs from multiple sources`);
      console.log(`   ✅ Works with any VEO3 generation (not hard-coded)`);
      console.log(`   ✅ Saves operation IDs for future use`);
      console.log(`   ✅ Loads from server, file, or fallback`);
      console.log(`   ✅ Google Storage URL detection`);
      console.log(`   ✅ Automatic Creatomate integration`);
      console.log(`\n📁 OPERATION ID SOURCES (in order):`);
      console.log(`   1. Running server: /api/active-batches`);
      console.log(`   2. File: operations.json, veo3_operations.json`);
      console.log(`   3. Fallback: Hard-coded IDs (update manually)`);
      console.log(`\n💾 AUTO-SAVING:`);
      console.log(`   Creates operations.json with current IDs for future use`);
      
    } else {
      // Default: auto-detect and check
      await checker.checkStatus('auto');
    }
    
  } catch (error) {
    console.error(`❌ Flexible status check failed: ${error.message}`);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('   - Make sure VEO3Generator module exists');
    console.log('   - Check gcloud auth: gcloud auth login');
    console.log('   - Verify Google Cloud Storage permissions');
    console.log('   - Try: node check_veo3_status_flexible.js --help');
    process.exit(1);
  }
}

// Export for use as module
module.exports = FlexibleVEO3StatusChecker;

// Run if called directly
if (require.main === module) {
  main();
}