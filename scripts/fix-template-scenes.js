const mongoose = require('mongoose');
const Template = require('../models/Template');
require('dotenv').config();

async function fixTemplateScenes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veo5', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Update the countdown template's media slots to ensure they all have scene assignments
    const template = await Template.findOne({ templateId: 'countdown-timer-launch' });
    
    if (template) {
      // Ensure all media slots have proper scene assignments
      template.mediaSlots = [
        {
          name: "teaser_media",
          type: "video_or_image",
          scene: 1,
          label: "Teaser Background"
        },
        {
          name: "countdown_bg",
          type: "video_or_image",
          scene: 2,
          label: "Countdown Background"
        },
        {
          name: "reveal_media",
          type: "video_or_image",
          scene: 3,
          label: "Final Reveal Media"
        }
      ];
      
      // Fix fields to ensure they have proper scene assignments
      template.fields = [
        {
          name: "event_name",
          type: "text",
          label: "Event Name",
          placeholder: "Big Launch",
          defaultValue: "Coming Soon",
          maxLength: 30,
          scene: 1,
          required: true
        },
        {
          name: "countdown_from",
          type: "text",
          label: "Countdown Start",
          placeholder: "3",
          defaultValue: "3",
          maxLength: 2,
          scene: 2,
          required: true
        },
        {
          name: "reveal_text",
          type: "text",
          label: "Reveal Text",
          placeholder: "It's Here!",
          defaultValue: "It's Here!",
          maxLength: 25,
          scene: 3,
          required: true
        }
      ];
      
      await template.save();
      console.log('✅ Fixed countdown template');
    }
    
    // Fix all templates to ensure proper scene assignments
    const allTemplates = await Template.find({});
    
    for (const tmpl of allTemplates) {
      let updated = false;
      
      // Ensure all mediaSlots have scene assignments
      if (tmpl.mediaSlots && tmpl.mediaSlots.length > 0) {
        tmpl.mediaSlots.forEach((slot, index) => {
          if (!slot.scene) {
            // Distribute slots across scenes
            slot.scene = Math.ceil((index + 1) / Math.ceil(tmpl.mediaSlots.length / tmpl.scenes));
            updated = true;
          }
        });
      }
      
      // Ensure all fields have scene assignments
      if (tmpl.fields && tmpl.fields.length > 0) {
        tmpl.fields.forEach((field, index) => {
          if (!field.scene) {
            // Distribute fields across scenes
            field.scene = Math.ceil((index + 1) / Math.ceil(tmpl.fields.length / tmpl.scenes));
            updated = true;
          }
        });
      }
      
      if (updated) {
        await tmpl.save();
        console.log(`✅ Updated scenes for: ${tmpl.name}`);
      }
    }
    
    console.log('\n✨ Scene fix complete!');
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixTemplateScenes();