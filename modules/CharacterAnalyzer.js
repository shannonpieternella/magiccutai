// modules/CharacterAnalyzer.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class CharacterAnalyzer {
  
  constructor(options = {}) {
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    this.templatesDir = options.templatesDir || './templates';
    this.enableFileStorage = options.enableFileStorage !== false;
    
    // In-memory storage voor templates
    this.templates = new Map();
    
    // Ensure templates directory exists
    this.initializeStorage();
    
    console.log('🔍 CharacterAnalyzer initialized');
    console.log(`   - OpenAI API: ${this.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   - File Storage: ${this.enableFileStorage ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   - Templates Dir: ${this.templatesDir}`);
  }

  // Initialize storage directories
  initializeStorage() {
    if (this.enableFileStorage && !fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      console.log(`📁 Created templates directory: ${this.templatesDir}`);
    }
  }

  // Automatic image detection in images directory
  detectCharacterImage() {
    console.log(`🔍 Auto-detecting character image in ./images...`);
    
    const imagesDir = './images';
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
    
    // Ensure images directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images directory: ${imagesDir}`);
      throw new Error(`No images directory found. Please add an image file to ${imagesDir}/`);
    }
    
    // Find all image files
    const allFiles = fs.readdirSync(imagesDir);
    const imageFiles = allFiles.filter(file => 
      imageExtensions.includes(path.extname(file).toLowerCase())
    );
    
    console.log(`📂 Found ${allFiles.length} total files, ${imageFiles.length} image files`);
    
    if (imageFiles.length === 0) {
      throw new Error(`No image files found in ${imagesDir}/. Please add a character image (jpg, png, webp, etc.)`);
    }
    
    if (imageFiles.length > 1) {
      console.log(`⚠️ Multiple images found: ${imageFiles.join(', ')}`);
      console.log(`📸 Using first image: ${imageFiles[0]}`);
      console.log(`💡 TIP: Keep only 1 image in images/ directory for automatic detection`);
    }
    
    const selectedImage = imageFiles[0];
    const imagePath = path.join(imagesDir, selectedImage);
    
    console.log(`✅ Auto-selected image: ${selectedImage}`);
    console.log(`📍 Full path: ${imagePath}`);
    
    // Show image info
    const imageStats = fs.statSync(imagePath);
    const imageSizeMB = (imageStats.size / 1024 / 1024).toFixed(2);
    console.log(`📏 Image size: ${imageSizeMB}MB`);
    
    return imagePath;
  }

  // HOOFDFUNCTIE: Auto-detect image → Character Template
  async analyzeCharacterAuto() {
    console.log(`\n🔍 STARTING AUTOMATIC CHARACTER ANALYSIS`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // Auto-detect image
      const imagePath = this.detectCharacterImage();
      
      // Analyze the detected image
      return await this.analyzeImage(imagePath);
      
    } catch (error) {
      console.error(`❌ Automatic character analysis failed: ${error.message}`);
      throw error;
    }
  }

  // HOOFDFUNCTIE: Foto → Character Template  
  async analyzeImage(imagePath) {
    console.log(`\n🔍 ANALYZING CHARACTER IMAGE`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`📸 Image: ${imagePath}`);
    
    try {
      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }
      
      const imageStats = fs.statSync(imagePath);
      const imageSizeMB = (imageStats.size / 1024 / 1024).toFixed(2);
      console.log(`📏 Image size: ${imageSizeMB}MB`);
      
      // Check if image is too small
      if (imageStats.size < 10000) { // Less than 10KB
        console.log(`⚠️ Image very small (${imageSizeMB}MB), might cause OpenAI issues`);
        console.log(`💡 Consider using a larger, higher quality image`);
      }
      
      let characterTemplate;
      
      if (this.openaiApiKey) {
        console.log(`🤖 Using GPT-4 Turbo for analysis...`);
        characterTemplate = await this.analyzeWithOpenAI(imagePath);
      } else {
        console.log(`⚠️ OpenAI API key not found, using fallback analysis...`);
        characterTemplate = this.createFallbackTemplate(imagePath);
      }
      
      // Generate unique ID and save template
      const templateId = this.generateTemplateId(characterTemplate);
      const savedTemplate = await this.saveTemplate(templateId, characterTemplate, imagePath);
      
      console.log(`✅ CHARACTER ANALYSIS COMPLETED`);
      console.log(`   - Character: ${characterTemplate.character.name}`);
      console.log(`   - Template ID: ${templateId}`);
      console.log(`   - Voice: ${characterTemplate.character.voiceProfileSelection.selectedVoice}`);
      
      return {
        templateId,
        characterTemplate: savedTemplate,
        analysisMethod: this.openaiApiKey ? 'openai' : 'fallback'
      };
      
    } catch (error) {
      console.error(`❌ Character analysis failed: ${error.message}`);
      throw new Error(`Character analysis failed: ${error.message}`);
    }
  }

  // GPT-4 Turbo API Analysis met image upload
  async analyzeWithOpenAI(imagePath) {
    console.log(`🧠 Calling GPT-4 Turbo API with image upload...`);
    
    try {
      // Read and encode image
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(imagePath);
      
      // GPT-4 Turbo prompt - ENHANCED FOR EXTREME DETAILS
      const analysisPrompt = `
You are an expert cinematic video prompt writer. Your task is to analyze this image with EXTREME precision and detail for character consistency across multiple video scenes.

CRITICAL: Every description must be EXTREMELY DETAILED - minimum 15-20 words per field. Use specific colors, textures, measurements, and visual characteristics.

ANALYZE THIS IMAGE WITH EXTREME DETAIL:

**Facial Features - BE EXTREMELY SPECIFIC:**
- Exact eye color and shape: Describe precise color (e.g., "deep amber brown with golden flecks and green undertones"), exact shape (almond, round, hooded), eyelid structure, eyebrow arch, lash color/length
- Distinct nose structure: Precise shape, bridge width, nostril size/flare, tip characteristics, profile view details
- Lip fullness and shape: Exact fullness (thin/medium/full), cupid's bow definition, corner shape, natural color, texture
- Subtle wrinkles or lines: Exact location and depth of any lines, smile lines, crow's feet, forehead lines
- Cheekbone prominence: Height, definition, angular vs soft, shadowing patterns
- Jawline definition: Strength, angle, width, softness, proportions to face

**Hair - BE EXTREMELY SPECIFIC:**
- Precise color: Exact base color, highlight colors, lowlight tones, color variations, roots vs ends
- Exact style and cut: Length measurements, layering, part location, styling method, volume, movement
- Texture: Coarse/fine, straight/wavy/curly degree, thickness, density, shine level
- Flyaways or specific strands: Exact placement of any loose strands, baby hairs, styling imperfections

**Skin - BE EXTREMELY SPECIFIC:**
- Skin tone: Base color, undertones (warm/cool/neutral), specific descriptors (olive, peachy, golden, etc.)
- Presence of freckles, moles, scars: Exact locations, sizes, colors, patterns
- Skin texture: Smoothness level, pore visibility, any texture variations, finish (matte/dewy)

**Build & Posture - BE EXTREMELY SPECIFIC:**
- Exact body type: Specific build descriptors, shoulder width, proportions, fitness level indicators
- Typical posture: Spine alignment, shoulder position, head tilt, stance characteristics

**Clothing & Accessories - BE EXTREMELY SPECIFIC:**
- Specific garment types and fit: Exact clothing items, fit description, style details, condition
- Fabric textures: Material types, weave, finish, drape, quality indicators
- Specific details: Button types, stitching visible, pockets, collars, cuffs, any wear/wrinkles
- Jewelry: Exact pieces, metals, sizes, styles, placement
- Eyeglasses style: Frame style, color, size, or "None visible"

**Demeanor & Expressions - BE EXTREMELY SPECIFIC:**
- Recurring micro-expressions: Exact facial muscle movements, eye expressions, mouth position
- Feel of their presence: Detailed personality impression, energy level, approachability factors

Return ONLY a JSON object with EXTREME detail in every field:

{
  "character": {
    "name": "[Professional character name based on appearance]",
    "visualRefinement": {
      "facialFeatures": {
        "exactEyeColorAndShape": "[MINIMUM 20 words with precise color, shape, structure details]",
        "distinctNoseStructure": "[MINIMUM 15 words with exact shape, proportions, characteristics]",
        "lipFullnessAndShape": "[MINIMUM 15 words with fullness, shape, color, texture details]",
        "subtleWrinklesOrLines": "[MINIMUM 10 words describing any lines or smooth areas]",
        "cheekboneProminence": "[MINIMUM 15 words with exact structure and definition]",
        "jawlineDefinition": "[MINIMUM 15 words with precise shape and strength]"
      },
      "hair": {
        "preciseColor": "[MINIMUM 20 words with exact colors, highlights, variations]",
        "exactStyleAndCut": "[MINIMUM 20 words with precise cut, styling, length, shape]",
        "texture": "[MINIMUM 15 words with exact texture, thickness, quality details]",
        "flyawaysOrSpecificStrands": "[MINIMUM 10 words about specific hair placement details]"
      },
      "skin": {
        "skinTone": "[MINIMUM 15 words with precise color and undertone details]",
        "presenceOfFrecklesMolesScars": "[MINIMUM 10 words about any skin features or 'None visible']",
        "skinTexture": "[MINIMUM 15 words about texture, finish, quality]"
      },
      "buildAndPosture": {
        "exactBodyType": "[MINIMUM 15 words with specific build and proportion details]",
        "typicalPosture": "[MINIMUM 15 words with precise posture and bearing details]"
      },
      "clothingAndAccessories": {
        "specificGarmentTypesAndFit": "[MINIMUM 20 words with exact clothing details and fit]",
        "fabricTextures": "[MINIMUM 15 words with specific fabric and material details]",
        "specificDetails": "[MINIMUM 15 words with precise clothing feature details]",
        "jewelry": "[MINIMUM 10 words with exact jewelry details or 'None visible']",
        "eyeglassesStyle": "[MINIMUM 10 words with frame details or 'None visible']"
      },
      "demeanorAndExpressions": {
        "recurringMicroExpressions": "[MINIMUM 15 words with specific facial expression details]",
        "feelOfTheirPresence": "[MINIMUM 20 words with detailed personality and energy impression]"
      }
    },
    "voiceProfileSelection": {
      "selectedVoice": "[Healthcare/Caring OR Professional/Business OR Creative/Artistic OR Heroic/Strong OR Friendly/Approachable OR Mysterious/Dramatic]",
      "voiceDescription": "[Detailed voice description matching the selected profile]",
      "selectionReasoning": "[Explain WHY this voice fits based on detailed appearance analysis]"
    },
    "category": "[healthcare/business/creative/personal/heroic/other]"
  },
  "veo3Consistency": {
    "wardrobe": "[Detailed clothing description for scene consistency]",
    "physicalTraits": "[Key detailed physical features for consistency]",
    "mannerisms": "[Specific detailed gestures and expressions]",
    "environmentSuggestions": ["environment1", "environment2", "environment3"]
  },
  "cinematicStyle": "[Detailed cinematic style recommendation]"
}

CRITICAL: Every field must have EXTREME detail. No generic descriptions allowed. Be specific about colors, measurements, textures, and characteristics.
      `;
      
      // API call to GPT-4 Turbo with image
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4-turbo",  // GPT-4 Turbo zoals je wilde
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt
              },
              {
                type: "image_url", 
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      const content = response.data.choices[0].message.content;
      console.log(`📝 GPT-4 Turbo response received (${content.length} characters)`);
      console.log(`🔍 Response preview: "${content.substring(0, 200)}..."`);
      
      // Check if response is too short
      if (content.length < 100) {
        console.log(`⚠️ GPT-4 Turbo response too short, likely an error or refusal`);
        console.log(`📄 Full response: "${content}"`);
        throw new Error(`GPT-4 Turbo response too short: ${content}`);
      }
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`❌ No JSON found in GPT-4 Turbo response`);
        console.log(`📄 Full response: "${content}"`);
        throw new Error('No valid JSON found in GPT-4 Turbo response');
      }
      
      const characterData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      this.validateCharacterTemplate(characterData);
      
      console.log(`✅ GPT-4 Turbo analysis successful`);
      console.log(`   - Character: ${characterData.character.name}`);
      console.log(`   - Category: ${characterData.character.category}`);
      
      return characterData;
      
    } catch (error) {
      console.error(`❌ GPT-4 Turbo analysis failed: ${error.message}`);
      
      if (error.response) {
        console.error(`   - HTTP Status: ${error.response.status}`);
        console.error(`   - Error Details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      
      // Fallback to default template
      console.log(`🔄 Falling back to default character template...`);
      return this.createFallbackTemplate(imagePath);
    }
  }

  // Fallback template creation using EXACT template format
  createFallbackTemplate(imagePath) {
    console.log(`🎭 Creating fallback character template using exact template format...`);
    
    const filename = path.basename(imagePath, path.extname(imagePath)).toLowerCase();
    
    // Advanced automatic voice selection based on filename and context
    let category = 'business';
    let name = 'Alex Professional';
    let selectedVoice = 'Professional/Business';
    let voiceDescription = 'Confident, articulate, professional business tone with natural authority and competence';
    let selectionReasoning = 'Professional context and business setting suggests confident, articulate professional voice';
    
    // Healthcare/Beauty detection
    if (filename.includes('beauty') || filename.includes('health') || filename.includes('medical') || filename.includes('doctor') || filename.includes('nurse') || filename.includes('wellness')) {
      category = 'healthcare';
      name = 'Dr. Maya Wellness';
      selectedVoice = 'Healthcare/Caring';
      voiceDescription = 'Warm, confident, caring tone with professional expertise - trusted healthcare expert who combines technical knowledge with genuine concern for client wellbeing';
      selectionReasoning = 'Healthcare/beauty context and professional medical setting suggests caring, expert voice with warmth and trustworthiness';
    } 
    // Creative/Artistic detection
    else if (filename.includes('creative') || filename.includes('art') || filename.includes('design') || filename.includes('artist') || filename.includes('studio')) {
      category = 'creative';
      name = 'Jordan Creative';
      selectedVoice = 'Creative/Artistic';
      voiceDescription = 'Expressive, passionate, creative energy with artistic flair and innovative thinking that inspires others';
      selectionReasoning = 'Creative/artistic context suggests expressive, passionate voice with artistic sensibility and creative energy';
    }
    // Heroic/Strong detection  
    else if (filename.includes('hero') || filename.includes('super') || filename.includes('strong') || filename.includes('leader') || filename.includes('champion')) {
      category = 'heroic';
      name = 'Alex Hero';
      selectedVoice = 'Heroic/Strong';
      voiceDescription = 'Bold, determined, inspirational tone with unwavering confidence and natural leadership that motivates others';
      selectionReasoning = 'Heroic/leadership context suggests bold, inspirational voice with strength and natural authority';
    }
    // Friendly/Approachable detection
    else if (filename.includes('friendly') || filename.includes('warm') || filename.includes('customer') || filename.includes('service') || filename.includes('welcome')) {
      category = 'personal';
      name = 'Sam Friendly';
      selectedVoice = 'Friendly/Approachable';
      voiceDescription = 'Warm, conversational, engaging tone that makes people feel comfortable, valued, and genuinely welcomed';
      selectionReasoning = 'Friendly/service context suggests warm, approachable voice with natural charm and welcoming energy';
    }
    // Mysterious/Dramatic detection
    else if (filename.includes('mystery') || filename.includes('dark') || filename.includes('dramatic') || filename.includes('intense') || filename.includes('shadow')) {
      category = 'personal';
      name = 'Morgan Mystery';
      selectedVoice = 'Mysterious/Dramatic';
      voiceDescription = 'Deep, intriguing, dramatic tone with captivating presence and subtle intensity that draws people in';
      selectionReasoning = 'Mysterious/dramatic context suggests intriguing, dramatic voice with captivating depth and magnetic presence';
    }
    
    return {
      character: {
        name,
        visualRefinement: {
          facialFeatures: {
            exactEyeColorAndShape: "Deep brown almond-shaped eyes with subtle amber flecks that reflect intelligence and natural confidence, well-defined eyelids with naturally arched eyebrows",
            distinctNoseStructure: "Straight nose with gently rounded tip and perfectly proportioned nostrils, creating harmonious facial balance and refined appearance",
            lipFullnessAndShape: "Medium-full lips with natural rose undertone and well-defined cupid's bow, corners that naturally curve into a warm, professional smile",
            subtleWrinklesOrLines: "Subtle laugh lines around the eyes showing warmth and experience, no visible forehead lines, maintaining a youthful professional appearance",
            cheekboneProminence: "Naturally defined cheekbones with gentle contour and professional structure, not overly sharp but beautifully balanced",
            jawlineDefinition: "Strong yet refined jawline with balanced proportions and confident definition, showing natural authority without harshness"
          },
          hair: {
            preciseColor: "Rich dark brown with natural golden highlights visible in professional lighting, healthy natural color variation with depth",
            exactStyleAndCut: "Contemporary professional styling with precise cut, well-groomed and polished presentation appropriate for the setting",
            texture: "Natural medium texture with healthy appearance and professional maintenance, showing attention to personal care and detail",
            flyawaysOrSpecificStrands: "Neatly styled with intentional placement, no distracting flyaways, professional presentation with controlled styling"
          },
          skin: {
            skinTone: "Even medium complexion with warm undertones and healthy natural glow, professional appearance showing good self-care",
            presenceOfFrecklesMolesScars: "Clear professional complexion with no visible blemishes or distracting features, natural healthy skin appearance",
            skinTexture: "Smooth, well-maintained professional appearance with natural radiance and healthy glow showing excellent skincare routine"
          },
          buildAndPosture: {
            exactBodyType: "Medium athletic build with confident presence and well-proportioned physique showing self-discipline and health consciousness",
            typicalPosture: "Erect and confident posture showing competence and approachable authority, engaged body language with professional bearing"
          },
          clothingAndAccessories: {
            specificGarmentTypesAndFit: "Tailored professional attire in navy blue with crisp white accents, perfectly fitted and contemporary styling showing attention to professional image",
            fabricTextures: "High-quality cotton blend fabric with professional finish and excellent drape, premium materials with refined texture",
            specificDetails: "Careful attention to professional details including precise stitching, quality buttons, and appropriate styling choices that enhance credibility",
            jewelry: "Subtle silver accessories including small stud earrings and professional watch, tasteful choices that enhance rather than distract",
            eyeglassesStyle: "None visible, or if present would be contemporary professional frames that complement facial features"
          },
          demeanorAndExpressions: {
            recurringMicroExpressions: "Confident focus with genuine warmth, professional engagement with authentic interest, competent expression with human approachability",
            feelOfTheirPresence: "Approachable expertise that combines professional competence with genuine warmth, trustworthy authority with natural human connection"
          }
        },
        voiceProfileSelection: {
          selectedVoice,
          voiceDescription,
          selectionReasoning
        },
        category
      },
      veo3Consistency: {
        wardrobe: "Tailored professional attire in navy blue with crisp white accents, consistently styled across all scenes with attention to professional image",
        physicalTraits: "Deep brown almond eyes with amber flecks, rich dark brown hair with golden highlights, even warm-toned complexion, naturally defined cheekbones, strong refined jawline",
        mannerisms: "Confident professional gestures with genuine warmth, expert competence in movement, approachable authority in body language and facial expressions",
        environmentSuggestions: ["modern professional office with contemporary design", "sleek business center meeting room", "upscale workplace environment", "professional consultation space with premium finishes"]
      },
      cinematicStyle: "Professional cinematography with confident lighting that emphasizes competence and trustworthiness while maintaining human warmth and approachability"
    };
  }

  // Template validation
  validateCharacterTemplate(template) {
    const required = [
      'character.name',
      'character.visualRefinement.facialFeatures.exactEyeColorAndShape',
      'character.voiceProfileSelection.selectedVoice',
      'veo3Consistency.wardrobe'
    ];
    
    for (const field of required) {
      const value = this.getNestedValue(template, field);
      if (!value) {
        throw new Error(`Required field missing: ${field}`);
      }
    }
    
    console.log(`✅ Character template validation passed`);
  }

  // Get nested object value by dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  // Generate unique template ID
  generateTemplateId(template) {
    const name = template.character.name.toLowerCase().replace(/\s+/g, '_');
    const timestamp = Date.now().toString().slice(-6);
    return `${name}_${timestamp}`;
  }

  // Save template (memory + file + database)
  async saveTemplate(templateId, template, imagePath) {
    console.log(`💾 Saving character template: ${templateId}`);
    
    // Clean up old templates for same image first
    await this.cleanupOldTemplates(imagePath);
    
    const templateData = {
      id: templateId,
      template,
      metadata: {
        sourceImage: imagePath,
        createdAt: new Date().toISOString(),
        analysisMethod: this.openaiApiKey ? 'openai' : 'fallback'
      }
    };
    
    // Save to memory
    this.templates.set(templateId, templateData);
    console.log(`   ✅ Saved to memory storage`);
    
    // Save to file (if enabled)
    if (this.enableFileStorage) {
      try {
        const filePath = path.join(this.templatesDir, `${templateId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(templateData, null, 2));
        console.log(`   ✅ Saved to file: ${filePath}`);
      } catch (error) {
        console.error(`   ⚠️ File save failed: ${error.message}`);
      }
    }
    
    // TODO: Save to database (implement later)
    console.log(`   ⏳ Database save: Not implemented yet`);
    
    return templateData;
  }

  // Get template by ID
  getTemplate(templateId) {
    console.log(`🔍 Retrieving template: ${templateId}`);
    
    // Check memory first
    const memoryTemplate = this.templates.get(templateId);
    if (memoryTemplate) {
      console.log(`   ✅ Found in memory storage`);
      return memoryTemplate;
    }
    
    // Check file storage
    if (this.enableFileStorage) {
      try {
        const filePath = path.join(this.templatesDir, `${templateId}.json`);
        if (fs.existsSync(filePath)) {
          const fileData = fs.readFileSync(filePath, 'utf8');
          const templateData = JSON.parse(fileData);
          
          // Cache in memory for next time
          this.templates.set(templateId, templateData);
          console.log(`   ✅ Found in file storage, cached to memory`);
          return templateData;
        }
      } catch (error) {
        console.error(`   ⚠️ File read failed: ${error.message}`);
      }
    }
    
    console.log(`   ❌ Template not found: ${templateId}`);
    return null;
  }

  // List all templates
  listTemplates() {
    console.log(`\n📚 AVAILABLE CHARACTER TEMPLATES`);
    console.log('═══════════════════════════════════════');
    
    const templates = [];
    
    // Memory templates
    for (const [id, data] of this.templates) {
      templates.push({
        id,
        name: data.template.character.name,
        category: data.template.character.category,
        voice: data.template.character.voiceProfileSelection.selectedVoice,
        source: 'memory',
        created: data.metadata.createdAt
      });
    }
    
    // File templates (if not already in memory)
    if (this.enableFileStorage && fs.existsSync(this.templatesDir)) {
      const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const templateId = path.basename(file, '.json');
        
        if (!this.templates.has(templateId)) {
          try {
            const filePath = path.join(this.templatesDir, file);
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            templates.push({
              id: templateId,
              name: fileData.template.character.name,
              category: fileData.template.character.category,
              voice: fileData.template.character.voiceProfileSelection.selectedVoice,
              source: 'file',
              created: fileData.metadata.createdAt
            });
          } catch (error) {
            console.error(`   ⚠️ Error reading ${file}: ${error.message}`);
          }
        }
      }
    }
    
    if (templates.length === 0) {
      console.log(`📭 No templates found`);
    } else {
      templates.forEach(template => {
        console.log(`\n🎭 ${template.name} (${template.id})`);
        console.log(`   Category: ${template.category}`);
        console.log(`   Voice: ${template.voice}`);
        console.log(`   Source: ${template.source}`);
        console.log(`   Created: ${template.created}`);
      });
    }
    
    return templates;
  }

  // Helper: Get MIME type from file extension
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  // Test function - automatically detects image
  async runTest() {
    console.log(`\n🧪 RUNNING CHARACTER ANALYZER TEST`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // Use automatic detection
      const result = await this.analyzeCharacterAuto();
      
      // Test retrieval
      const retrieved = this.getTemplate(result.templateId);
      
      // Show ONLY the new template (not all templates)
      console.log(`\n📋 NEW CHARACTER TEMPLATE CREATED`);
      console.log('═══════════════════════════════════════');
      console.log(`🎭 ${result.characterTemplate.template.character.name} (${result.templateId})`);
      console.log(`   Category: ${result.characterTemplate.template.character.category}`);
      console.log(`   Voice: ${result.characterTemplate.template.character.voiceProfileSelection.selectedVoice}`);
      console.log(`   Method: ${result.analysisMethod}`);
      console.log(`   Created: ${result.characterTemplate.metadata.createdAt}`);
      console.log(`   Source Image: ${result.characterTemplate.metadata.sourceImage}`);
      
      console.log(`\n✅ CHARACTER ANALYZER TEST PASSED!`);
      console.log(`   - Template ID: ${result.templateId}`);
      console.log(`   - Character: ${result.characterTemplate.template.character.name}`);
      console.log(`   - Method: ${result.analysisMethod}`);
      console.log(`   - Voice: ${result.characterTemplate.template.character.voiceProfileSelection.selectedVoice}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Character Analyzer test failed: ${error.message}`);
      throw error;
    }
  }

  // Clean up old templates for same image
  async cleanupOldTemplates(sourceImage) {
    if (!this.enableFileStorage) return;
    
    console.log(`🧹 Cleaning up old templates for: ${sourceImage}`);
    
    try {
      if (fs.existsSync(this.templatesDir)) {
        const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json'));
        let cleaned = 0;
        
        for (const file of files) {
          try {
            const filePath = path.join(this.templatesDir, file);
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // If same source image, delete old template
            if (fileData.metadata && fileData.metadata.sourceImage === sourceImage) {
              fs.unlinkSync(filePath);
              console.log(`   🗑️ Removed old template: ${file}`);
              cleaned++;
            }
          } catch (error) {
            // Skip problematic files
          }
        }
        
        if (cleaned > 0) {
          console.log(`✅ Cleaned up ${cleaned} old template(s)`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Cleanup failed: ${error.message}`);
    }
  }
}

module.exports = CharacterAnalyzer;

// CLI interface for testing
if (require.main === module) {
  const analyzer = new CharacterAnalyzer();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--list-all')) {
    // Show all templates
    analyzer.listTemplates();
  } else if (args[0] && fs.existsSync(args[0])) {
    // If specific image path provided and exists, use it
    console.log(`📸 Using specified image: ${args[0]}`);
    analyzer.analyzeImage(args[0]).then(result => {
      console.log(`✅ Analysis complete: ${result.characterTemplate.template.character.name}`);
    }).catch(error => {
      console.error('Analysis failed:', error.message);
      process.exit(1);
    });
  } else {
    // Auto-detect image in images directory (default behavior)
    console.log(`🔍 Auto-detecting image in images/ directory...`);
    console.log(`💡 Use --list-all to see all saved templates`);
    analyzer.runTest().catch(error => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
  }
}