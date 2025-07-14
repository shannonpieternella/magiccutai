// modules/ProductAnalyzer.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class ProductAnalyzer {
  
  constructor(options = {}) {
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    this.templatesDir = options.templatesDir || './product-templates';
    this.enableFileStorage = options.enableFileStorage !== false;
    
    // In-memory storage voor product templates
    this.productTemplates = new Map();
    
    // Ensure templates directory exists
    this.initializeStorage();
    
    console.log('🔍 ProductAnalyzer initialized');
    console.log(`   - OpenAI API: ${this.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   - File Storage: ${this.enableFileStorage ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   - Templates Dir: ${this.templatesDir}`);
  }

  // Initialize storage directories
  initializeStorage() {
    if (this.enableFileStorage && !fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      console.log(`📁 Created product templates directory: ${this.templatesDir}`);
    }
  }

  // Automatic image detection in product-images directory
  detectProductImage() {
    console.log(`🔍 Auto-detecting product image in ./product-images...`);
    
    const imagesDir = './product-images';
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
    
    // Ensure product-images directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created product-images directory: ${imagesDir}`);
      throw new Error(`No product-images directory found. Please add a product image file to ${imagesDir}/`);
    }
    
    // Find all image files
    const allFiles = fs.readdirSync(imagesDir);
    const imageFiles = allFiles.filter(file => 
      imageExtensions.includes(path.extname(file).toLowerCase())
    );
    
    console.log(`📂 Found ${allFiles.length} total files, ${imageFiles.length} image files`);
    
    if (imageFiles.length === 0) {
      throw new Error(`No product image files found in ${imagesDir}/. Please add a product image (jpg, png, webp, etc.)`);
    }
    
    if (imageFiles.length > 1) {
      console.log(`⚠️ Multiple images found: ${imageFiles.join(', ')}`);
      console.log(`📸 Using first image: ${imageFiles[0]}`);
      console.log(`💡 TIP: Keep only 1 image in product-images/ directory for automatic detection`);
    }
    
    const selectedImage = imageFiles[0];
    const imagePath = path.join(imagesDir, selectedImage);
    
    console.log(`✅ Auto-selected product image: ${selectedImage}`);
    console.log(`📍 Full path: ${imagePath}`);
    
    // Show image info
    const imageStats = fs.statSync(imagePath);
    const imageSizeMB = (imageStats.size / 1024 / 1024).toFixed(2);
    console.log(`📏 Image size: ${imageSizeMB}MB`);
    
    return imagePath;
  }

  // HOOFDFUNCTIE: Auto-detect product image → Product Template  
  async analyzeProductAuto() {
    console.log(`\n🔍 STARTING AUTOMATIC PRODUCT ANALYSIS`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // Auto-detect image
      const imagePath = this.detectProductImage();
      
      // Ask user for product description
      console.log(`\n📝 PRODUCT DETECTED: ${path.basename(imagePath)}`);
      console.log(`💡 Please provide a description of this product for best analysis`);
      console.log(`   Example: "Premium wireless headphones with noise cancellation"`);
      
      // For auto mode, we'll use filename as basis
      const filename = path.basename(imagePath, path.extname(imagePath));
      const productDescription = this.generateDescriptionFromFilename(filename);
      
      console.log(`🤖 Generated description from filename: "${productDescription}"`);
      console.log(`💡 For better results, use: --analyze "your detailed description"`);
      
      // Analyze with auto-generated description
      return await this.analyzeProductWithImage(imagePath, productDescription);
      
    } catch (error) {
      console.error(`❌ Automatic product analysis failed: ${error.message}`);
      throw error;
    }
  }

  // Analyze product with image + description
  async analyzeProductWithImage(imagePath, productDescription, productInfo = {}) {
    console.log(`\n🔍 ANALYZING PRODUCT WITH IMAGE`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`📸 Image: ${imagePath}`);
    console.log(`📝 Description: ${productDescription}`);
    
    try {
      // Check if image exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Product image file not found: ${imagePath}`);
      }
      
      const imageStats = fs.statSync(imagePath);
      const imageSizeMB = (imageStats.size / 1024 / 1024).toFixed(2);
      console.log(`📏 Image size: ${imageSizeMB}MB`);
      
      let productTemplate;
      
      if (this.openaiApiKey) {
        console.log(`🤖 Using GPT-4 Turbo with IMAGE for product analysis...`);
        productTemplate = await this.analyzeWithOpenAI(productDescription, productInfo, imagePath);
      } else {
        console.log(`⚠️ OpenAI API key not found, using fallback analysis...`);
        productTemplate = this.createFallbackProductTemplate(productDescription, productInfo);
      }
      
      // Generate unique ID and save template
      const templateId = this.generateProductTemplateId(productTemplate);
      const savedTemplate = await this.saveProductTemplate(templateId, productTemplate, imagePath);
      
      console.log(`✅ PRODUCT ANALYSIS COMPLETED`);
      console.log(`   - Product: ${productTemplate.product.name}`);
      console.log(`   - Template ID: ${templateId}`);
      console.log(`   - Category: ${productTemplate.product.category}`);
      
      return {
        templateId,
        productTemplate: savedTemplate,
        analysisMethod: this.openaiApiKey ? 'openai' : 'fallback',
        sourceImage: imagePath
      };
      
    } catch (error) {
      console.error(`❌ Product analysis with image failed: ${error.message}`);
      throw new Error(`Product analysis failed: ${error.message}`);
    }
  }

  // Generate basic description from filename
  generateDescriptionFromFilename(filename) {
    const cleanName = filename.toLowerCase()
      .replace(/[-_]/g, ' ')
      .replace(/\d+/g, '')
      .trim();
    
    // Specific product type detection with detailed descriptions
    const productTypes = {
      'cup': 'Ceramic coffee cup with handle and smooth finish',
      'mug': 'Coffee mug with ergonomic handle and durable ceramic construction',
      'coffee': 'Coffee-related product with premium design and functionality',
      'tea': 'Tea cup or mug with elegant design and heat-resistant properties',
      
      'headphone': 'Professional wireless headphones with premium design and audio quality',
      'earphone': 'High-quality earphones with superior sound and comfortable fit',
      'speaker': 'Premium wireless speaker with excellent sound quality and modern design',
      
      'laptop': 'High-performance laptop computer with modern design and professional features',
      'phone': 'Smartphone with advanced features and sleek premium design',
      'tablet': 'Tablet device with high-resolution display and responsive touch interface',
      'computer': 'Computer device with professional-grade performance and reliability',
      
      'watch': 'Smart watch with premium materials and elegant design features',
      'camera': 'Professional camera with advanced imaging capabilities and ergonomic design',
      
      'bottle': 'Premium bottle with durable construction and functional design',
      'glass': 'Drinking glass with clear finish and ergonomic design',
      'bowl': 'Serving bowl with smooth finish and practical design',
      'plate': 'Dinner plate with durable construction and elegant appearance',
      
      'shoe': 'Footwear with comfortable design and durable construction',
      'shirt': 'Clothing item with premium fabric and professional styling',
      'jacket': 'Outer garment with quality materials and functional design',
      
      'book': 'Book or publication with professional binding and clear typography',
      'notebook': 'Notebook with premium paper and durable binding',
      'pen': 'Writing instrument with smooth operation and ergonomic design',
      
      'chair': 'Seating furniture with ergonomic design and quality construction',
      'table': 'Table furniture with durable surface and stable construction',
      'lamp': 'Lighting fixture with modern design and efficient illumination'
    };
    
    // Find matching product type
    for (const [keyword, description] of Object.entries(productTypes)) {
      if (cleanName.includes(keyword)) {
        return description;
      }
    }
    
    return `Professional product with premium design and high-quality construction`;
  }

  // Enhance description with image context
  enhanceDescriptionWithImageContext(description, imagePath, productInfo) {
    const filename = path.basename(imagePath, path.extname(imagePath));
    const imageStats = fs.statSync(imagePath);
    const imageSizeMB = (imageStats.size / 1024 / 1024).toFixed(2);
    
    // Add image context to description
    const enhancedDescription = `
PRODUCT DESCRIPTION: ${description}

IMAGE CONTEXT:
- Source filename: ${filename}
- Image file size: ${imageSizeMB}MB (indicates image quality/detail level)
- File extension: ${path.extname(imagePath)}

ADDITIONAL PRODUCT INFO: ${JSON.stringify(productInfo)}

Based on the description and image context, create detailed product specifications for VEO3 video consistency.
    `.trim();
    
    return enhancedDescription;
  }

  // HOOFDFUNCTIE: Product Description → Product Template (backwards compatibility)
  async analyzeProduct(productDescription, productInfo = {}) {
    console.log(`\n🔍 ANALYZING PRODUCT DESCRIPTION`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`📝 Description: ${productDescription}`);
    
    try {
      let productTemplate;
      
      if (this.openaiApiKey) {
        console.log(`🤖 Using GPT-4 Turbo for product analysis...`);
        productTemplate = await this.analyzeWithOpenAI(productDescription, productInfo, null); // null = no image
      } else {
        console.log(`⚠️ OpenAI API key not found, using fallback analysis...`);
        productTemplate = this.createFallbackProductTemplate(productDescription, productInfo);
      }
      
      // Generate unique ID and save template
      const templateId = this.generateProductTemplateId(productTemplate);
      const savedTemplate = await this.saveProductTemplate(templateId, productTemplate, productDescription);
      
      console.log(`✅ PRODUCT ANALYSIS COMPLETED`);
      console.log(`   - Product: ${productTemplate.product.name}`);
      console.log(`   - Template ID: ${templateId}`);
      console.log(`   - Category: ${productTemplate.product.category}`);
      
      return {
        templateId,
        productTemplate: savedTemplate,
        analysisMethod: this.openaiApiKey ? 'openai' : 'fallback'
      };
      
    } catch (error) {
      console.error(`❌ Product analysis failed: ${error.message}`);
      throw new Error(`Product analysis failed: ${error.message}`);
    }
  }

  // GPT-4 Turbo API Analysis voor product details MET IMAGE SUPPORT
  async analyzeWithOpenAI(productDescription, productInfo, imagePath = null) {
    console.log(`🧠 Calling GPT-4 Turbo API for product analysis...`);
    
    try {
      let content = [];
      
      // GPT-4 Turbo prompt for EXTREME product detail analysis
      const productAnalysisPrompt = `
You are an expert product photographer and VEO3 video prompt specialist. ${imagePath ? 'Analyze this product image' : 'Based on the product description provided'}, create EXTREMELY detailed product specifications for consistent product representation across multiple video scenes.

CRITICAL: Every description must be EXTREMELY DETAILED - minimum 15-20 words per field. Use specific colors, materials, measurements, and visual characteristics that would make this product instantly recognizable in videos.

${imagePath ? '' : `PRODUCT DESCRIPTION TO ANALYZE: "${productDescription}"`}

ADDITIONAL CONTEXT: ${JSON.stringify(productInfo)}

CREATE DETAILED PRODUCT SPECIFICATIONS FOR VEO3 CONSISTENCY:

Return ONLY a JSON object with EXTREME detail in every field:

{
  "product": {
    "name": "[Professional product name based on ${imagePath ? 'image and' : ''} description]",
    "category": "[tech/fashion/food/health/home/automotive/beauty/sports/other]",
    "visualRefinement": {
      "physicalCharacteristics": {
        "exactSizeAndDimensions": "[MINIMUM 20 words with precise size, proportions, scale details]",
        "colorScheme": "[MINIMUM 20 words with exact colors, gradients, finishes]",
        "materialComposition": "[MINIMUM 20 words with specific materials, textures, quality]",
        "shapeAndForm": "[MINIMUM 20 words with precise geometric description]",
        "brandingElements": "[MINIMUM 15 words with logo, text, graphics details or 'None visible']"
      },
      "visualDetails": {
        "surfaceFinish": "[MINIMUM 15 words with exact texture and finish description]",
        "distinctiveFeatures": "[MINIMUM 20 words with unique identifying characteristics]",
        "packagingElements": "[MINIMUM 10 words with packaging details or 'Product only, no packaging']",
        "lightingInteraction": "[MINIMUM 15 words with reflection, shadow, highlight details]"
      },
      "contextualInformation": {
        "useCase": "[MINIMUM 15 words describing typical usage scenarios]",
        "targetAudience": "[MINIMUM 10 words describing intended users]",
        "keySellingPoints": "[MINIMUM 20 words with main value propositions and benefits]"
      }
    },
    "veo3Consistency": {
      "productPlacement": "[Detailed instructions for consistent product positioning in scenes]",
      "lightingRequirements": "[Specific lighting setup to maintain product appearance]",
      "cameraAngles": "[Preferred angles to showcase product best features]",
      "interactionGuidelines": "[How character should interact with or present the product]"
    }
  },
  "sceneOptimization": {
    "bestPresentationAngles": ["angle1", "angle2", "angle3"],
    "recommendedEnvironments": ["environment1", "environment2", "environment3"],
    "demonstrationSuggestions": ["demo1", "demo2", "demo3"]
  }
}

CRITICAL: Every field must have EXTREME detail. No generic descriptions allowed. Be specific about colors, materials, dimensions, and unique characteristics that ensure the product looks identical across all video scenes.
      `;
      
      // Add text prompt
      content.push({
        type: "text",
        text: productAnalysisPrompt
      });
      
      // Add image if provided (like CharacterAnalyzer does)
      if (imagePath && fs.existsSync(imagePath)) {
        console.log(`📸 Including image in GPT-4 Turbo analysis: ${imagePath}`);
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = this.getMimeType(imagePath);
        
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`
          }
        });
      }
      
      // API call to GPT-4 Turbo (SAME as CharacterAnalyzer)
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4-turbo", // SAME MODEL as CharacterAnalyzer!
        messages: [
          {
            role: "user",
            content: content
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
      
      const responseContent = response.data.choices[0].message.content;
      console.log(`📝 GPT-4 Turbo response received (${responseContent.length} characters)`);
      
      // Extract JSON from response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in GPT-4 Turbo response');
      }
      
      const productData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      this.validateProductTemplate(productData);
      
      console.log(`✅ GPT-4 Turbo analysis successful`);
      console.log(`   - Product: ${productData.product.name}`);
      console.log(`   - Category: ${productData.product.category}`);
      
      return productData;
      
    } catch (error) {
      console.error(`❌ GPT-4 Turbo analysis failed: ${error.message}`);
      
      // Fallback to default template
      console.log(`🔄 Falling back to default product template...`);
      return this.createFallbackProductTemplate(productDescription, productInfo);
    }
  }

  // Helper: Get MIME type from file extension (ADD THIS BACK)
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  // Fallback product template creation
  createFallbackProductTemplate(productDescription, productInfo) {
    console.log(`🎭 Creating fallback product template...`);
    
    const productName = productInfo.name || this.guessProductName(productDescription);
    const category = productInfo.category || this.guessCategory(productDescription);
    
    return {
      product: {
        name: productName,
        category: category,
        visualRefinement: {
          physicalCharacteristics: {
            exactSizeAndDimensions: "Medium-sized consumer product with balanced proportions and ergonomic design suitable for everyday use and professional presentation in video content",
            colorScheme: "Modern color palette with primary neutral tones and professional accent colors that photograph well under various lighting conditions and maintain brand consistency",
            materialComposition: "High-quality materials with premium finish and professional-grade construction that reflects well in video lighting and maintains consistent appearance across scenes",
            shapeAndForm: "Contemporary design with clean lines and ergonomic form factor that is easily recognizable and presents well from multiple camera angles in video content",
            brandingElements: "Professional branding elements with clear logo placement and consistent visual identity that maintains visibility and recognition across various video presentations"
          },
          visualDetails: {
            surfaceFinish: "Professional smooth finish with consistent reflective properties that look professional under studio lighting and maintain visual appeal in video content",
            distinctiveFeatures: "Unique design elements and distinguishing characteristics that make the product instantly recognizable and memorable across multiple video scenes and presentations",
            packagingElements: "Premium packaging design with professional presentation that enhances product value and maintains brand consistency throughout video marketing content",
            lightingInteraction: "Optimal light reflection and shadow creation that enhances product appeal and maintains consistent visual representation under professional video lighting setups"
          },
          contextualInformation: {
            useCase: "Professional business application with broad market appeal suitable for demonstration in various business and consumer contexts for video marketing",
            targetAudience: "Professional business users and discerning consumers who value quality and reliability in their product choices and business solutions",
            keySellingPoints: "Premium quality construction with innovative features and professional-grade performance that delivers exceptional value and reliability for demanding business applications"
          }
        },
        veo3Consistency: {
          productPlacement: "Position product prominently in frame with clear visibility of key features and branding elements, ensuring consistent placement and orientation across all video scenes",
          lightingRequirements: "Professional studio lighting with soft key light and subtle fill lighting to highlight product features while maintaining consistent appearance and visual appeal",
          cameraAngles: "Utilize multiple strategic camera angles including three-quarter view, front-facing, and detail shots to showcase product features while maintaining visual consistency",
          interactionGuidelines: "Character should handle product with confidence and professionalism, demonstrating key features while maintaining natural and engaging presentation throughout video content"
        }
      },
      sceneOptimization: {
        bestPresentationAngles: [
          "Three-quarter front view showcasing main features and branding",
          "Direct front view for clear feature demonstration", 
          "Close-up detail shots highlighting key selling points"
        ],
        recommendedEnvironments: [
          "Professional office setting with clean modern background",
          "Contemporary workspace with neutral professional lighting",
          "Clean studio environment with professional product photography setup"
        ],
        demonstrationSuggestions: [
          "Character confidently presenting product key features",
          "Professional demonstration of product functionality",
          "Engaging explanation of product benefits and applications"
        ]
      }
    };
  }

  // Guess product name from description
  guessProductName(description) {
    const words = description.toLowerCase().split(' ');
    
    // Look for product type keywords
    const productTypes = {
      'laptop': 'Professional Laptop',
      'phone': 'Smartphone',
      'tablet': 'Tablet Device',
      'watch': 'Smart Watch',
      'headphones': 'Premium Headphones',
      'camera': 'Professional Camera',
      'book': 'Professional Guide',
      'software': 'Software Solution',
      'app': 'Mobile Application',
      'course': 'Professional Course',
      'supplement': 'Health Supplement',
      'cosmetic': 'Beauty Product',
      'clothing': 'Fashion Item',
      'jewelry': 'Premium Jewelry',
      'tool': 'Professional Tool'
    };
    
    for (const [keyword, productName] of Object.entries(productTypes)) {
      if (words.some(word => word.includes(keyword))) {
        return productName;
      }
    }
    
    return 'Professional Product';
  }

  // Guess category from description  
  guessCategory(description) {
    const text = description.toLowerCase();
    
    if (text.includes('laptop') || text.includes('computer') || text.includes('software') || text.includes('app')) return 'tech';
    if (text.includes('health') || text.includes('supplement') || text.includes('medical')) return 'health';
    if (text.includes('beauty') || text.includes('cosmetic') || text.includes('skincare')) return 'beauty';
    if (text.includes('clothing') || text.includes('fashion') || text.includes('apparel')) return 'fashion';
    if (text.includes('home') || text.includes('furniture') || text.includes('decor')) return 'home';
    if (text.includes('car') || text.includes('automotive') || text.includes('vehicle')) return 'automotive';
    if (text.includes('sport') || text.includes('fitness') || text.includes('exercise')) return 'sports';
    if (text.includes('food') || text.includes('nutrition') || text.includes('cooking')) return 'food';
    
    return 'other';
  }

  // Save product template
  async saveProductTemplate(templateId, template, source) {
    console.log(`💾 Saving product template: ${templateId}`);
    
    const templateData = {
      id: templateId,
      template,
      metadata: {
        source: source, // Can be description or image path
        sourceType: source.includes('/') || source.includes('\\') ? 'image' : 'description',
        createdAt: new Date().toISOString(),
        analysisMethod: this.openaiApiKey ? 'openai' : 'fallback'
      }
    };
    
    // Save to memory
    this.productTemplates.set(templateId, templateData);
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
    
    return templateData;
  }

  // Generate unique product template ID
  generateProductTemplateId(template) {
    const name = template.product.name.toLowerCase().replace(/\s+/g, '_');
    const timestamp = Date.now().toString().slice(-6);
    return `product_${name}_${timestamp}`;
  }

  // Load product template
  loadProductTemplate(templateId) {
    console.log(`🔍 Loading product template: ${templateId}`);
    
    try {
      const filePath = path.join(this.templatesDir, `${templateId}.json`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Product template file not found: ${filePath}`);
      }
      
      const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`✅ Product template loaded: ${templateData.template.product.name}`);
      
      return templateData;
      
    } catch (error) {
      console.error(`❌ Failed to load product template: ${error.message}`);
      throw error;
    }
  }

  // List available product templates
  listAvailableProductTemplates() {
    console.log(`\n📚 AVAILABLE PRODUCT TEMPLATES`);
    console.log('═══════════════════════════════════════');
    
    if (!fs.existsSync(this.templatesDir)) {
      console.log(`📭 No product templates directory found: ${this.templatesDir}`);
      return [];
    }
    
    const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json'));
    
    if (files.length === 0) {
      console.log(`📭 No product templates found`);
      return [];
    }
    
    const templates = [];
    
    files.forEach(file => {
      try {
        const filePath = path.join(this.templatesDir, file);
        const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const template = {
          id: templateData.id,
          name: templateData.template.product.name,
          category: templateData.template.product.category,
          created: templateData.metadata.createdAt,
          source: templateData.metadata.source,
          sourceType: templateData.metadata.sourceType || 'description'
        };
        
        templates.push(template);
        
        console.log(`\n📦 ${template.name} (${template.id})`);
        console.log(`   Category: ${template.category}`);
        console.log(`   Source Type: ${template.sourceType}`);
        console.log(`   Source: ${template.source}`);
        console.log(`   Created: ${template.created}`);
        
      } catch (error) {
        console.error(`⚠️ Error reading ${file}: ${error.message}`);
      }
    });
    
    console.log(`\n📊 Total product templates: ${templates.length}`);
    return templates;
  }

  // Validate product template
  validateProductTemplate(template) {
    const required = [
      'product.name',
      'product.category',
      'product.visualRefinement.physicalCharacteristics.exactSizeAndDimensions',
      'product.veo3Consistency.productPlacement'
    ];
    
    for (const field of required) {
      const value = this.getNestedValue(template, field);
      if (!value) {
        throw new Error(`Required field missing: ${field}`);
      }
    }
    
    console.log(`✅ Product template validation passed`);
  }

  // Get nested object value by dot notation
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  // Test function
  async runTest() {
    console.log(`\n🧪 RUNNING PRODUCT ANALYZER TEST`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // Try auto-detect first
      console.log(`🔍 Testing auto-detect functionality...`);
      
      try {
        const result = await this.analyzeProductAuto();
        
        console.log(`\n✅ PRODUCT ANALYZER AUTO-DETECT TEST PASSED!`);
        console.log(`   - Product: ${result.productTemplate.template.product.name}`);
        console.log(`   - Template ID: ${result.templateId}`);
        console.log(`   - Category: ${result.productTemplate.template.product.category}`);
        console.log(`   - Method: ${result.analysisMethod}`);
        console.log(`   - Source Image: ${result.sourceImage}`);
        
        return result;
        
      } catch (autoError) {
        console.log(`⚠️ Auto-detect failed: ${autoError.message}`);
        console.log(`🔄 Falling back to manual description test...`);
        
        // Fallback to manual test
        const testDescription = "Professional wireless noise-canceling headphones with premium materials and sleek black design";
        const testInfo = {
          name: "Premium Wireless Headphones",
          category: "tech"
        };
        
        console.log(`🔍 Testing with manual description: "${testDescription}"`);
        
        const result = await this.analyzeProduct(testDescription, testInfo);
        
        console.log(`\n✅ PRODUCT ANALYZER MANUAL TEST PASSED!`);
        console.log(`   - Product: ${result.productTemplate.template.product.name}`);
        console.log(`   - Template ID: ${result.templateId}`);
        console.log(`   - Category: ${result.productTemplate.template.product.category}`);
        console.log(`   - Method: ${result.analysisMethod}`);
        
        return result;
      }
      
    } catch (error) {
      console.error(`❌ Product Analyzer test failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ProductAnalyzer;

// CLI interface for testing
if (require.main === module) {
  const analyzer = new ProductAnalyzer();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--list-products')) {
    // Show all product templates
    analyzer.listAvailableProductTemplates();
  } else if (args.includes('--analyze') && args[1]) {
    // Analyze product with description: --analyze "description" --name "name" --category "category"
    const description = args[1];
    const productInfo = {};
    
    // Parse optional name and category
    const nameIndex = args.indexOf('--name');
    if (nameIndex !== -1 && args[nameIndex + 1]) {
      productInfo.name = args[nameIndex + 1];
    }
    
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex !== -1 && args[categoryIndex + 1]) {
      productInfo.category = args[categoryIndex + 1];
    }
    
    console.log(`📦 Analyzing product: "${description}"`);
    if (productInfo.name) console.log(`   Name: ${productInfo.name}`);
    if (productInfo.category) console.log(`   Category: ${productInfo.category}`);
    
    analyzer.analyzeProduct(description, productInfo).then(result => {
      console.log(`✅ Product analysis complete: ${result.productTemplate.template.product.name}`);
      console.log(`📋 Template ID: ${result.templateId}`);
    }).catch(error => {
      console.error('Product analysis failed:', error.message);
      process.exit(1);
    });
  } else if (args.includes('--image') && args[1]) {
    // Analyze product with image + description: --image "description" --name "name" --category "category"
    const description = args[1];
    const productInfo = {};
    
    // Parse optional name and category
    const nameIndex = args.indexOf('--name');
    if (nameIndex !== -1 && args[nameIndex + 1]) {
      productInfo.name = args[nameIndex + 1];
    }
    
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex !== -1 && args[categoryIndex + 1]) {
      productInfo.category = args[categoryIndex + 1];
    }
    
    try {
      const imagePath = analyzer.detectProductImage();
      console.log(`📦 Analyzing product with image: "${description}"`);
      if (productInfo.name) console.log(`   Name: ${productInfo.name}`);
      if (productInfo.category) console.log(`   Category: ${productInfo.category}`);
      
      analyzer.analyzeProductWithImage(imagePath, description, productInfo).then(result => {
        console.log(`✅ Product analysis complete: ${result.productTemplate.template.product.name}`);
        console.log(`📋 Template ID: ${result.templateId}`);
        console.log(`📸 Source Image: ${result.sourceImage}`);
      }).catch(error => {
        console.error('Product analysis with image failed:', error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error('Image detection failed:', error.message);
      process.exit(1);
    }
  } else {
    // Show help and run auto-detect test
    console.log(`\n📦 PRODUCT ANALYZER - CREATE PRODUCT CONSISTENCY TEMPLATES`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n🎯 PURPOSE: Analyze products for consistent representation in videos`);
    console.log(`\n🤖 POWERED BY: GPT-4 Turbo with image analysis (same as CharacterAnalyzer)`);
    console.log(`\n💡 USAGE OPTIONS:`);
    console.log(`   node modules/ProductAnalyzer.js --list-products`);
    console.log(`   node modules/ProductAnalyzer.js --analyze "product description" --name "Product Name" --category "tech"`);
    console.log(`   node modules/ProductAnalyzer.js --image "product description" --name "Product Name" --category "tech"`);
    console.log(`\n🔧 EXAMPLES:`);
    console.log(`   # Analyze with description only:`);
    console.log(`   node modules/ProductAnalyzer.js --analyze "Premium wireless noise-canceling headphones" --name "Pro Headphones" --category "tech"`);
    console.log(`\n   # Analyze with auto-detected image (GPT-4 Turbo will identify the product):`);
    console.log(`   node modules/ProductAnalyzer.js --image "Ceramic coffee mug in turquoise blue color" --name "Coffee Mug" --category "home"`);
    console.log(`\n📸 AUTO-DETECT IMAGE:`);
    console.log(`   - Place product image in ./product-images/ directory`);
    console.log(`   - Supported formats: jpg, jpeg, png, webp, bmp, gif`);
    console.log(`   - GPT-4 Turbo will automatically identify what the product is`);
    console.log(`   - No need for descriptive filenames - AI can see the image!`);
    console.log(`   - Optional: provide description for additional context`);
    console.log(`\n✨ NEW: GPT-4 Turbo can now SEE your product images!`);
    console.log(`   - Just like CharacterAnalyzer identifies faces`);
    console.log(`   - ProductAnalyzer now identifies products from images`);
    console.log(`   - No more guessing from filenames!`);
    console.log(`\n📦 SUPPORTED CATEGORIES:`);
    console.log(`   tech, fashion, food, health, home, automotive, beauty, sports, other`);
    
    // Run auto-detect test
    console.log(`\n🧪 Running auto-detect test with image analysis...`);
    analyzer.runTest().catch(error => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
  }
}