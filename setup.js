// setup.js - Automated VEO3 System Setup & Validation
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

class SystemSetup {
  
  constructor() {
    this.requiredDirs = [
      './images',
      './product-images', 
      './generated-videos',
      './edited-videos',
      './templates',
      './product-templates',
      './uploads'
    ];
    
    this.requiredEnvVars = [
      'OPENAI_API_KEY',
      'GOOGLE_CLOUD_PROJECT_ID',
      'GOOGLE_CLOUD_LOCATION',
      'CREATOMATE_API_KEY',
      'CREATOMATE_TEMPLATE_2_SCENES',
      'CREATOMATE_TEMPLATE_3_SCENES'
    ];
    
    this.optionalEnvVars = [
      'PORT',
      'NODE_ENV'
    ];
  }

  async runCompleteSetup() {
    console.log('\n🚀 VEO3 SYSTEM SETUP & VALIDATION');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎯 Setting up complete video production pipeline');
    console.log('📋 Character Analysis → VEO3 Generation → Professional Editing\n');
    
    try {
      // Step 1: Check Node.js and npm
      await this.checkNodeEnvironment();
      
      // Step 2: Check and install dependencies
      await this.checkDependencies();
      
      // Step 3: Create directories
      await this.createDirectories();
      
      // Step 4: Check environment variables
      await this.checkEnvironmentVariables();
      
      // Step 5: Test Google Cloud authentication
      await this.testGoogleCloudAuth();
      
      // Step 6: Test API connections
      await this.testAPIConnections();
      
      // Step 7: Run module tests
      await this.runModuleTests();
      
      // Step 8: Final summary
      this.displaySetupSummary();
      
    } catch (error) {
      console.error(`\n❌ Setup failed: ${error.message}`);
      this.displayTroubleshooting();
      process.exit(1);
    }
  }

  async checkNodeEnvironment() {
    console.log('🔍 1. CHECKING NODE.JS ENVIRONMENT');
    console.log('─'.repeat(50));
    
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      
      console.log(`✅ Node.js: ${nodeVersion}`);
      console.log(`✅ npm: ${npmVersion}`);
      
      // Check minimum Node.js version
      const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      if (majorVersion < 16) {
        throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
      }
      
    } catch (error) {
      throw new Error(`Node.js environment check failed: ${error.message}`);
    }
  }

  async checkDependencies() {
    console.log('\n🔍 2. CHECKING DEPENDENCIES');
    console.log('─'.repeat(50));
    
    try {
      // Check if package.json exists
      if (!fs.existsSync('./package.json')) {
        throw new Error('package.json not found');
      }
      
      // Check if node_modules exists
      if (!fs.existsSync('./node_modules')) {
        console.log('📦 Installing dependencies...');
        execSync('npm install', { stdio: 'inherit' });
      }
      
      // Verify key dependencies
      const requiredPackages = [
        'express',
        'multer', 
        'cors',
        'axios',
        'dotenv',
        'form-data'
      ];
      
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      const installedDeps = Object.keys(packageJson.dependencies || {});
      
      for (const pkg of requiredPackages) {
        if (installedDeps.includes(pkg)) {
          console.log(`✅ ${pkg}: installed`);
        } else {
          console.log(`⚠️ ${pkg}: missing - installing...`);
          execSync(`npm install ${pkg}`, { stdio: 'inherit' });
        }
      }
      
    } catch (error) {
      throw new Error(`Dependencies check failed: ${error.message}`);
    }
  }

  async createDirectories() {
    console.log('\n🔍 3. CREATING DIRECTORIES');
    console.log('─'.repeat(50));
    
    for (const dir of this.requiredDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created: ${dir}`);
      } else {
        console.log(`✅ Exists: ${dir}`);
      }
    }
  }

  async checkEnvironmentVariables() {
    console.log('\n🔍 4. CHECKING ENVIRONMENT VARIABLES');
    console.log('─'.repeat(50));
    
    // Check if .env exists
    if (!fs.existsSync('./.env')) {
      console.log('📝 Creating .env file from template...');
      if (fs.existsSync('./.env.example')) {
        fs.copyFileSync('./.env.example', './.env');
        console.log('✅ Created .env from .env.example');
        console.log('⚠️ Please edit .env file with your API keys');
      } else {
        throw new Error('.env file not found and no .env.example template available');
      }
    }
    
    // Check required environment variables
    const missing = [];
    const configured = [];
    
    for (const envVar of this.requiredEnvVars) {
      if (process.env[envVar]) {
        configured.push(envVar);
        console.log(`✅ ${envVar}: configured`);
      } else {
        missing.push(envVar);
        console.log(`❌ ${envVar}: missing`);
      }
    }
    
    // Check optional variables
    for (const envVar of this.optionalEnvVars) {
      if (process.env[envVar]) {
        console.log(`✅ ${envVar}: ${process.env[envVar]}`);
      } else {
        console.log(`⚠️ ${envVar}: using default`);
      }
    }
    
    if (missing.length > 0) {
      console.log(`\n⚠️ Missing required environment variables:`);
      missing.forEach(envVar => console.log(`   - ${envVar}`));
      console.log('\n💡 Please edit .env file with your API keys');
      console.log('   - OpenAI: https://platform.openai.com/api-keys');
      console.log('   - Google Cloud: Use project ID contentgen-465421');
      console.log('   - Creatomate: https://creatomate.com (API key provided)');
    }
  }

  async testGoogleCloudAuth() {
    console.log('\n🔍 5. TESTING GOOGLE CLOUD AUTHENTICATION');
    console.log('─'.repeat(50));
    
    try {
      // Check if gcloud CLI is installed
      const gcloudVersion = execSync('gcloud --version', { encoding: 'utf8' });
      console.log('✅ Google Cloud CLI installed');
      
      // Check authentication
      const activeAccount = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { encoding: 'utf8' }).trim();
      
      if (activeAccount) {
        console.log(`✅ Authenticated as: ${activeAccount}`);
        
        // Check project
        const currentProject = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
        if (currentProject === process.env.GOOGLE_CLOUD_PROJECT_ID) {
          console.log(`✅ Project set correctly: ${currentProject}`);
        } else {
          console.log(`⚠️ Project mismatch - setting to ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
          execSync(`gcloud config set project ${process.env.GOOGLE_CLOUD_PROJECT_ID}`);
        }
        
      } else {
        console.log('❌ Not authenticated with Google Cloud');
        console.log('💡 Run: gcloud auth login');
      }
      
    } catch (error) {
      console.log('❌ Google Cloud CLI not found or not configured');
      console.log('💡 Install: https://cloud.google.com/sdk/docs/install');
      console.log('💡 Then run: gcloud auth login');
    }
  }

  async testAPIConnections() {
    console.log('\n🔍 6. TESTING API CONNECTIONS');
    console.log('─'.repeat(50));
    
    // Test OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const axios = require('axios');
        await axios.get('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
          timeout: 10000
        });
        console.log('✅ OpenAI API: connected');
      } catch (error) {
        console.log('❌ OpenAI API: connection failed');
        console.log(`   Error: ${error.message}`);
      }
    }
    
    // Test Creatomate
    if (process.env.CREATOMATE_API_KEY) {
      try {
        const axios = require('axios');
        await axios.get('https://api.creatomate.com/v1/templates', {
          headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}` },
          timeout: 10000
        });
        console.log('✅ Creatomate API: connected');
      } catch (error) {
        console.log('❌ Creatomate API: connection failed');
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  async runModuleTests() {
    console.log('\n🔍 7. TESTING MODULES');
    console.log('─'.repeat(50));
    
    const modules = [
      { name: 'CharacterAnalyzer', file: './modules/CharacterAnalyzer.js' },
      { name: 'ProductAnalyzer', file: './modules/ProductAnalyzer.js' },
      { name: 'PromptGenerator', file: './modules/PromptGenerator.js' },
      { name: 'VEO3Generator', file: './modules/VEO3Generator.js' },
      { name: 'CreatomateEditor', file: './modules/CreatomateEditor.js' }
    ];
    
    for (const module of modules) {
      try {
        if (fs.existsSync(module.file)) {
          require(module.file);
          console.log(`✅ ${module.name}: loaded successfully`);
        } else {
          console.log(`❌ ${module.name}: file not found`);
        }
      } catch (error) {
        console.log(`❌ ${module.name}: load failed - ${error.message}`);
      }
    }
  }

  displaySetupSummary() {
    console.log('\n🎉 SETUP COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎬 VEO3 Video Production Pipeline Ready!');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Start server: npm run dev');
    console.log('   2. Open browser: http://localhost:3000');
    console.log('   3. Upload character image');
    console.log('   4. Create custom scenes');
    console.log('   5. Generate VEO3 videos ($1.20/video)');
    console.log('   6. Edit with Creatomate templates');
    console.log('');
    console.log('💰 COST STRUCTURE:');
    console.log('   - VEO3 Fast: $1.20 per 8-second video');
    console.log('   - 16 seconds: $2.40 per video');
    console.log('   - 24 seconds: $3.60 per video');
    console.log('');
    console.log('🔧 AVAILABLE COMMANDS:');
    console.log('   npm run dev          # Start development server');
    console.log('   npm start            # Start production server');
    console.log('   node setup.js        # Run this setup again');
    console.log('');
    console.log('📚 DOCUMENTATION:');
    console.log('   README.md            # Complete documentation');
    console.log('   .env.example         # Environment variables template');
    console.log('');
    console.log('🎯 COMPLETE WORKFLOW:');
    console.log('   Character Image → GPT-4 Analysis → VEO3 Prompts');
    console.log('   → VEO3 Fast Videos → Creatomate Editing → Final Video');
    console.log('');
    console.log('✨ Happy video creating! 🎬');
  }

  displayTroubleshooting() {
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('─'.repeat(50));
    console.log('1. Node.js Issues:');
    console.log('   - Install Node.js 16+: https://nodejs.org');
    console.log('   - Check version: node --version');
    console.log('');
    console.log('2. Dependencies Issues:');
    console.log('   - Clear cache: npm cache clean --force');
    console.log('   - Reinstall: rm -rf node_modules && npm install');
    console.log('');
    console.log('3. Environment Variables:');
    console.log('   - Copy template: cp .env.example .env');
    console.log('   - Edit .env with your API keys');
    console.log('');
    console.log('4. Google Cloud Issues:');
    console.log('   - Install CLI: https://cloud.google.com/sdk');
    console.log('   - Login: gcloud auth login');
    console.log('   - Set project: gcloud config set project contentgen-465421');
    console.log('');
    console.log('5. API Issues:');
    console.log('   - Check API keys in .env file');
    console.log('   - Verify account credits/limits');
    console.log('   - Test network connectivity');
    console.log('');
    console.log('📞 For more help, check README.md or create an issue');
  }

  // Quick health check
  async quickHealthCheck() {
    console.log('\n🏥 QUICK HEALTH CHECK');
    console.log('─'.repeat(50));
    
    const checks = [
      { name: 'Node.js', check: () => execSync('node --version', { encoding: 'utf8' }) },
      { name: '.env file', check: () => fs.existsSync('./.env') },
      { name: 'Dependencies', check: () => fs.existsSync('./node_modules') },
      { name: 'OpenAI Key', check: () => process.env.OPENAI_API_KEY },
      { name: 'Google Cloud Project', check: () => process.env.GOOGLE_CLOUD_PROJECT_ID },
      { name: 'Creatomate Key', check: () => process.env.CREATOMATE_API_KEY }
    ];
    
    let passed = 0;
    
    for (const check of checks) {
      try {
        const result = check.check();
        if (result) {
          console.log(`✅ ${check.name}`);
          passed++;
        } else {
          console.log(`❌ ${check.name}`);
        }
      } catch (error) {
        console.log(`❌ ${check.name}`);
      }
    }
    
    console.log(`\n📊 Health Score: ${passed}/${checks.length}`);
    
    if (passed === checks.length) {
      console.log('🎉 System is healthy and ready!');
      console.log('🚀 Run: npm run dev');
    } else {
      console.log('⚠️ Some issues found. Run full setup: node setup.js');
    }
  }
}

// CLI interface
const setup = new SystemSetup();
const args = process.argv.slice(2);

if (args.includes('--health')) {
  setup.quickHealthCheck();
} else if (args.includes('--help')) {
  console.log('\n🔧 VEO3 SYSTEM SETUP');
  console.log('─'.repeat(50));
  console.log('Usage:');
  console.log('  node setup.js           # Full setup and validation');
  console.log('  node setup.js --health  # Quick health check');
  console.log('  node setup.js --help    # Show this help');
  console.log('');
  console.log('What this script does:');
  console.log('  ✅ Checks Node.js and npm');
  console.log('  ✅ Installs required dependencies');
  console.log('  ✅ Creates necessary directories');
  console.log('  ✅ Validates environment variables');
  console.log('  ✅ Tests Google Cloud authentication');
  console.log('  ✅ Tests API connections');
  console.log('  ✅ Validates all modules');
  console.log('  ✅ Provides setup summary and next steps');
} else {
  setup.runCompleteSetup();
}