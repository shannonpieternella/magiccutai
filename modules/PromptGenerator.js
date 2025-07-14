// modules/PromptGenerator.js
const fs = require('fs');
const path = require('path');

class PromptGenerator {
  
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || './templates';
    this.enableFileStorage = options.enableFileStorage !== false;
    
    // In-memory storage voor generated prompts
    this.generatedPrompts = new Map();
    
    console.log('📝 PromptGenerator initialized');
    console.log(`   - Templates Dir: ${this.templatesDir}`);
    console.log(`   - File Storage: ${this.enableFileStorage ? '✅ Enabled' : '❌ Disabled'}`);
  }

  // HOOFDFUNCTIE: Character Template + JOUW Scene Prompt → VEO3 Prompt
  generateCustomScenePrompt(characterTemplate, userScenePrompt, sceneNumber, dialogue = '', spokenLanguage = 'en') {
    console.log(`📝 Generating VEO3 prompt for scene ${sceneNumber} with custom scene`);
    console.log(`🗣️ Spoken language: ${this.getSpokenLanguageConfig(spokenLanguage).name}`);
    
    try {
      const prompt = this.buildCustomVEO3Prompt({
        character: characterTemplate,
        userScene: userScenePrompt,
        sceneNumber,
        dialogue,
        spokenLanguage
      });
      
      console.log(`✅ Custom VEO3 prompt generated (${prompt.length} characters)`);
      return prompt;
      
    } catch (error) {
      console.error(`❌ Custom prompt generation failed for scene ${sceneNumber}: ${error.message}`);
      throw error;
    }
  }

  // Build VEO3 prompt met JOUW scene + character details
  buildCustomVEO3Prompt({ character, userScene, sceneNumber, dialogue, spokenLanguage }) {
    const langConfig = this.getSpokenLanguageConfig(spokenLanguage);
    
    // Extract character details voor consistency
    const visualDetails = character.template.character.visualRefinement;
    const voiceProfile = character.template.character.voiceProfileSelection;
    const consistency = character.template.veo3Consistency;
    
    const dialogueSection = dialogue ? `
CHARACTER DIALOGUE (${langConfig.voiceInstructions}):
"${dialogue}"

VOICE: ${voiceProfile.voiceDescription}` : '';
    
    return `
COMPREHENSIVE DIRECTOR'S DESCRIPTION FOR VEO3:

CHARACTER SPECIFICATION (MUST BE EXACT):

FACIAL FEATURES:
- Eyes: ${visualDetails.facialFeatures.exactEyeColorAndShape}
- Nose: ${visualDetails.facialFeatures.distinctNoseStructure}
- Lips: ${visualDetails.facialFeatures.lipFullnessAndShape}
- Wrinkles/Lines: ${visualDetails.facialFeatures.subtleWrinklesOrLines}
- Cheekbones: ${visualDetails.facialFeatures.cheekboneProminence}
- Jawline: ${visualDetails.facialFeatures.jawlineDefinition}

HAIR:
- Color: ${visualDetails.hair.preciseColor}
- Style: ${visualDetails.hair.exactStyleAndCut}
- Texture: ${visualDetails.hair.texture}
- Details: ${visualDetails.hair.flyawaysOrSpecificStrands}

SKIN:
- Tone: ${visualDetails.skin.skinTone}
- Features: ${visualDetails.skin.presenceOfFrecklesMolesScars}
- Texture: ${visualDetails.skin.skinTexture}

BUILD & POSTURE:
- Body Type: ${visualDetails.buildAndPosture.exactBodyType}
- Posture: ${visualDetails.buildAndPosture.typicalPosture}

CLOTHING & ACCESSORIES:
- Garments: ${visualDetails.clothingAndAccessories.specificGarmentTypesAndFit}
- Fabric: ${visualDetails.clothingAndAccessories.fabricTextures}
- Details: ${visualDetails.clothingAndAccessories.specificDetails}
- Jewelry: ${visualDetails.clothingAndAccessories.jewelry}
- Eyewear: ${visualDetails.clothingAndAccessories.eyeglassesStyle}

DEMEANOR:
- Expressions: ${visualDetails.demeanorAndExpressions.recurringMicroExpressions}
- Presence: ${visualDetails.demeanorAndExpressions.feelOfTheirPresence}

SCENE ${sceneNumber}:
${userScene}${dialogueSection}

MANNERISMS: ${consistency.mannerisms}

VEO3 TECHNICAL REQUIREMENTS:
- 8-second scene duration
- Character face clearly visible for continuity
- Professional cinematography with native audio
- End with medium shot of character for scene transitions

CRITICAL: Generate the EXACT SAME CHARACTER as described above with identical appearance, wardrobe, and mannerisms. Every facial feature, hair detail, and clothing element must match precisely across all scenes.
    `.trim();
  }

  // Generate multiple custom scenes
  generateMultipleCustomScenes(characterTemplate, userScenes, spokenLanguage = 'en') {
    console.log(`\n🎬 GENERATING ${userScenes.length} CUSTOM VEO3 SCENE PROMPTS`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`🎭 Character: ${characterTemplate.template.character.name}`);
    console.log(`🗣️ Voice: ${characterTemplate.template.character.voiceProfileSelection.selectedVoice}`);
    console.log(`🌍 Spoken Language: ${this.getSpokenLanguageConfig(spokenLanguage).name}`);
    
    const prompts = userScenes.map((sceneData, index) => {
      const sceneNumber = index + 1;
      console.log(`\n📝 Scene ${sceneNumber}: ${sceneData.title || `Custom Scene ${sceneNumber}`}`);
      if (sceneData.dialogue) {
        console.log(`💬 Dialogue: "${sceneData.dialogue}"`);
      }
      
      const prompt = this.generateCustomScenePrompt(
        characterTemplate, 
        sceneData.scene, 
        sceneNumber, 
        sceneData.dialogue || '', 
        spokenLanguage
      );
      
      return {
        sceneNumber,
        title: sceneData.title || `Custom Scene ${sceneNumber}`,
        scene: sceneData.scene,
        dialogue: sceneData.dialogue || '',
        prompt: prompt,
        characterName: characterTemplate.template.character.name,
        voiceProfile: characterTemplate.template.character.voiceProfileSelection.selectedVoice,
        spokenLanguage: spokenLanguage
      };
    });
    
    // Save generated prompts
    const promptSetId = this.saveCustomPromptSet(characterTemplate, prompts);
    
    console.log(`\n✅ ALL ${prompts.length} CUSTOM SCENE PROMPTS GENERATED`);
    console.log(`   - Character: ${characterTemplate.template.character.name}`);
    console.log(`   - Spoken Language: ${this.getSpokenLanguageConfig(spokenLanguage).name}`);
    console.log(`   - Prompt Set ID: ${promptSetId}`);
    console.log(`   - Total Characters: ${prompts.reduce((sum, p) => sum + p.prompt.length, 0)}`);
    
    return {
      promptSetId,
      character: characterTemplate.template.character.name,
      prompts,
      spokenLanguage,
      metadata: {
        generatedAt: new Date().toISOString(),
        characterTemplateId: characterTemplate.id,
        spokenLanguage,
        type: 'custom'
      }
    };
  }

  // Save custom prompt set
  saveCustomPromptSet(characterTemplate, prompts) {
    const timestamp = Date.now().toString().slice(-6);
    const characterName = characterTemplate.template.character.name.toLowerCase().replace(/\s+/g, '_');
    const promptSetId = `custom_prompts_${characterName}_${timestamp}`;
    
    const promptSet = {
      id: promptSetId,
      type: 'custom',
      characterTemplateId: characterTemplate.id,
      character: characterTemplate.template.character,
      prompts,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalScenes: prompts.length,
        totalCharacters: prompts.reduce((sum, p) => sum + p.prompt.length, 0),
        spokenLanguage: prompts[0]?.spokenLanguage || 'en'
      }
    };
    
    // Save to memory
    this.generatedPrompts.set(promptSetId, promptSet);
    console.log(`💾 Custom prompt set saved to memory: ${promptSetId}`);
    
    // Save to file (if enabled)
    if (this.enableFileStorage) {
      try {
        const promptsDir = path.join(this.templatesDir, 'prompts');
        if (!fs.existsSync(promptsDir)) {
          fs.mkdirSync(promptsDir, { recursive: true });
        }
        
        const filePath = path.join(promptsDir, `${promptSetId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(promptSet, null, 2));
        console.log(`💾 Custom prompt set saved to file: ${filePath}`);
      } catch (error) {
        console.error(`⚠️ File save failed: ${error.message}`);
      }
    }
    
    return promptSetId;
  }

  // Simpele taalconfiguratie - alleen voor voice instructions
  getSpokenLanguageConfig(language) {
    const languages = {
      'nl': {
        name: 'Nederlands',
        voiceInstructions: 'Nederlandse uitspraak, natuurlijke Nederlandse stem'
      },
      'en': {
        name: 'English', 
        voiceInstructions: 'English pronunciation, natural English voice'
      },
      'de': {
        name: 'Deutsch',
        voiceInstructions: 'Deutsche Aussprache, natürliche deutsche Stimme'
      },
      'es': {
        name: 'Español',
        voiceInstructions: 'Pronunciación española, voz natural española'
      },
      'fr': {
        name: 'Français',
        voiceInstructions: 'Pronunciation française, voix française naturelle'
      },
      'it': {
        name: 'Italiano',
        voiceInstructions: 'Pronuncia italiana, voce italiana naturale'
      },
      'pt': {
        name: 'Português',
        voiceInstructions: 'Pronúncia portuguesa, voz portuguesa natural'
      },
      'ru': {
        name: 'Русский',
        voiceInstructions: 'Русское произношение, естественный русский голос'
      },
      'ja': {
        name: '日本語',
        voiceInstructions: 'Japanese pronunciation, natural Japanese voice'
      },
      'ko': {
        name: '한국어', 
        voiceInstructions: 'Korean pronunciation, natural Korean voice'
      },
      'zh': {
        name: '中文',
        voiceInstructions: 'Chinese pronunciation, natural Chinese voice'
      },
      'ar': {
        name: 'العربية',
        voiceInstructions: 'Arabic pronunciation, natural Arabic voice'
      }
    };
    
    return languages[language] || languages['en'];
  }

  // Load character template from CharacterAnalyzer
  loadCharacterTemplate(templateId) {
    console.log(`🔍 Loading character template: ${templateId}`);
    
    try {
      const filePath = path.join(this.templatesDir, `${templateId}.json`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Character template file not found: ${filePath}`);
      }
      
      const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`✅ Character template loaded: ${templateData.template.character.name}`);
      console.log(`   - No category restrictions - visual consistency only`);
      console.log(`   - Works with ANY scene type you provide`);
      
      return templateData;
      
    } catch (error) {
      console.error(`❌ Failed to load character template: ${error.message}`);
      throw error;
    }
  }

  // List available character templates
  listAvailableCharacterTemplates() {
    console.log(`\n📚 AVAILABLE CHARACTER TEMPLATES`);
    console.log('═══════════════════════════════════════');
    console.log(`🎯 Focus: Visual consistency only (no scene restrictions)`);
    
    if (!fs.existsSync(this.templatesDir)) {
      console.log(`📭 No templates directory found: ${this.templatesDir}`);
      return [];
    }
    
    const files = fs.readdirSync(this.templatesDir).filter(f => f.endsWith('.json') && !f.includes('prompts_'));
    
    if (files.length === 0) {
      console.log(`📭 No character templates found`);
      return [];
    }
    
    const templates = [];
    
    files.forEach(file => {
      try {
        const filePath = path.join(this.templatesDir, file);
        const templateData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        const template = {
          id: templateData.id,
          name: templateData.template.character.name,
          voice: templateData.template.character.voiceProfileSelection.selectedVoice,
          created: templateData.metadata.createdAt,
          sourceImage: templateData.metadata.sourceImage
        };
        
        templates.push(template);
        
        console.log(`\n🎭 ${template.name} (${template.id})`);
        console.log(`   Voice: ${template.voice}`);
        console.log(`   Source: ${template.sourceImage}`);
        console.log(`   Created: ${template.created}`);
        console.log(`   💡 Works with ANY scene you create`);
        
      } catch (error) {
        console.error(`⚠️ Error reading ${file}: ${error.message}`);
      }
    });
    
    console.log(`\n📊 Total templates: ${templates.length}`);
    console.log(`🎯 All templates work with custom scenes - no restrictions!`);
    return templates;
  }

  // Display formatted prompt results
  displayPromptResults(result) {
    console.log(`\n🎉 VEO3 PROMPTS GENERATED SUCCESSFULLY!`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`🎭 Character: ${result.character}`);
    console.log(`📦 Prompt Set ID: ${result.promptSetId}`);
    console.log(`🎬 Total Scenes: ${result.prompts.length}`);
    console.log(`🌍 Spoken Language: ${this.getSpokenLanguageConfig(result.spokenLanguage).name}`);
    console.log(`📊 Total Characters: ${result.prompts.reduce((sum, p) => sum + p.prompt.length, 0)}`);
    
    result.prompts.forEach((sceneData) => {
      console.log(`\n🎬 SCENE ${sceneData.sceneNumber}: ${sceneData.title}`);
      if (sceneData.dialogue) {
        console.log(`🗣️ Dialogue: "${sceneData.dialogue}"`);
      }
      console.log(`📝 VEO3 Prompt (${sceneData.prompt.length} chars):`);
      console.log('─'.repeat(80));
      console.log(sceneData.prompt);
      console.log('─'.repeat(80));
    });
    
    console.log(`\n✅ Ready for VEO3 video generation!`);
  }

  // Test function - demonstreer custom scene generation
  async runTest() {
    console.log(`\n🧪 RUNNING PROMPT GENERATOR TEST - CUSTOM SCENES`);
    console.log('═══════════════════════════════════════════════════');
    
    try {
      // List available templates
      const characterTemplates = this.listAvailableCharacterTemplates();
      
      if (characterTemplates.length === 0) {
        console.log(`⚠️ No character templates found. Please run CharacterAnalyzer first.`);
        console.log(`💡 Run: node modules/CharacterAnalyzer.js`);
        return;
      }
      
      // Use first available template
      const firstTemplate = characterTemplates[0];
      console.log(`\n🎭 Using character template: ${firstTemplate.name}`);
      
      // Demo custom scenes - any scenes work regardless of character type
      const demoScenes = [
        {
          title: "Professional Presentation",
          scene: "Character confidently presenting innovative solutions to an engaged audience in a modern conference room with professional lighting",
          dialogue: "This breakthrough approach will transform how we solve complex challenges"
        },
        {
          title: "Focused Work Session",
          scene: "Same character working intensely at a state-of-the-art workstation, analyzing complex data with laser-focused determination",
          dialogue: "The patterns in this data are revealing extraordinary insights"
        },
        {
          title: "Success Celebration",
          scene: "Same character celebrating remarkable achievements with colleagues in a bright, contemporary office environment",
          dialogue: "Together we have accomplished something truly exceptional and groundbreaking"
        }
      ];
      
      console.log(`\n📋 Demo scenes (work with ANY character):`);
      demoScenes.forEach((scene, i) => {
        console.log(`${i + 1}. ${scene.scene}`);
        console.log(`   Dialogue: "${scene.dialogue}"`);
      });
      
      // Load template and generate prompts
      const characterTemplate = this.loadCharacterTemplate(firstTemplate.id);
      const result = this.generateMultipleCustomScenes(characterTemplate, demoScenes, 'en');
      
      // Display results
      this.displayPromptResults(result);
      
      console.log(`\n✅ PROMPT GENERATOR TEST PASSED!`);
      console.log(`   - Character: ${result.character}`);
      console.log(`   - Scenes: ${result.prompts.length}`);
      console.log(`   - Spoken Language: ${result.spokenLanguage}`);
      console.log(`   - Prompt Set: ${result.promptSetId}`);
      console.log(`\n🎯 KEY SUCCESS: Character visual details injected into ANY scene type!`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Prompt Generator test failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PromptGenerator;

// CLI interface for testing
if (require.main === module) {
  const generator = new PromptGenerator();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--list-characters')) {
    generator.listAvailableCharacterTemplates();
  } else if (args.includes('--custom')) {
    // Custom scene generation: --custom characterId --language nl "scene1" "dialogue1" "scene2" "dialogue2"
    const customIndex = args.indexOf('--custom');
    const characterId = args[customIndex + 1];
    
    // Check for language parameter
    let spokenLanguage = 'en';
    let sceneStartIndex = customIndex + 2;
    
    if (args[customIndex + 2] === '--language' && args[customIndex + 3]) {
      spokenLanguage = args[customIndex + 3];
      sceneStartIndex = customIndex + 4;
      console.log(`🌍 Using spoken language: ${spokenLanguage}`);
    }
    
    const scenes = [];
    
    if (!characterId) {
      console.log(`❌ Please provide character template ID and scenes`);
      console.log(`💡 Usage: node modules/PromptGenerator.js --custom characterId --language nl "scene description" "dialogue" ...`);
      process.exit(1);
    }
    
    // Parse scenes from arguments (scene, dialogue pairs)
    for (let i = sceneStartIndex; i < args.length; i += 2) {
      if (args[i] && args[i + 1]) {
        scenes.push({
          title: `Scene ${scenes.length + 1}`,
          scene: args[i],
          dialogue: args[i + 1]
        });
      }
    }
    
    if (scenes.length === 0) {
      console.log(`❌ No scenes provided`);
      console.log(`💡 Provide scene/dialogue pairs: "scene description" "dialogue"`);
      console.log(`💡 Example: --custom dr._lena_morris_894318 --language nl "scene beschrijving" "Nederlandse dialogue"`);
      process.exit(1);
    }
    
    try {
      const characterTemplate = generator.loadCharacterTemplate(characterId);
      const result = generator.generateMultipleCustomScenes(characterTemplate, scenes, spokenLanguage);
      generator.displayPromptResults(result);
      console.log(`✅ Custom scenes generated: ${result.promptSetId}`);
      console.log(`🌍 Spoken language: ${result.spokenLanguage}`);
    } catch (error) {
      console.error('Custom generation failed:', error.message);
      process.exit(1);
    }
  } else {
    // Show help and run simple test
    console.log(`\n📝 PROMPTGENERATOR - CREATE VEO3 PROMPTS WITH CHARACTER CONSISTENCY`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`\n🎯 FOCUS: Visual character consistency (no forced categories)`);
    console.log(`\n💡 USAGE OPTIONS:`);
    console.log(`   node modules/PromptGenerator.js --list-characters`);
    console.log(`   node modules/PromptGenerator.js --custom characterId --language nl "scene1" "dialogue1" "scene2" "dialogue2"`);
    console.log(`\n🌍 SUPPORTED LANGUAGES:`);
    console.log(`   nl (Nederlands), en (English), de (Deutsch), es (Español), fr (Français)`);
    console.log(`   it (Italiano), pt (Português), ru (Русский), ja (日本語), ko (한국어), zh (中文), ar (العربية)`);
    console.log(`\n🔧 EXAMPLES:`);
    console.log(`   # Nederlandse gesproken taal:`);
    console.log(`   node modules/PromptGenerator.js --custom dr._lena_morris_894318 --language nl \\`);
    console.log(`     "Character analyzeert data in modern lab" "Deze resultaten zijn fascinerend" \\`);
    console.log(`     "Zelfde character presenteert bevindingen" "Dit verandert alles"`);
    console.log(`\n   # English spoken language:`);
    console.log(`   node modules/PromptGenerator.js --custom dr._lena_morris_894318 --language en \\`);
    console.log(`     "Character analyzing data in modern lab" "These results are fascinating" \\`);
    console.log(`     "Same character presenting findings" "This changes everything"`);
    
    // Run simple test
    console.log(`\n🧪 Running basic test...`);
    generator.runTest().catch(error => {
      console.error('Test failed:', error.message);
      process.exit(1);
    });
  }
}