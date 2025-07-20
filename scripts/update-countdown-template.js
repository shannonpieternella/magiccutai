const mongoose = require('mongoose');
const Template = require('../models/Template');
require('dotenv').config();

async function updateCountdownTemplate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veo5', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Update the countdown template to use the Creatomate base template
    const result = await Template.updateOne(
      { templateId: 'countdown-timer-launch' },
      { 
        $set: { 
          baseTemplateId: '41bf887a-d97b-47e6-9428-da4ad47c1a6a'
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Updated countdown template with base template ID');
    } else {
      console.log('⚠️  Template not found or already updated');
    }
    
    // Also update the template to have proper field mappings for the base template
    const template = await Template.findOne({ templateId: 'countdown-timer-launch' });
    if (template) {
      // Update field names to match what the base template expects
      template.fields = [
        {
          name: "Title",  // Changed from event_name
          type: "text",
          label: "Event Name",
          placeholder: "Big Launch",
          defaultValue: "Coming Soon",
          maxLength: 30,
          scene: 1,
          required: true
        },
        {
          name: "Subtitle",  // Changed from countdown_from
          type: "text",
          label: "Countdown Number",
          placeholder: "3",
          defaultValue: "3",
          maxLength: 2,
          scene: 2,
          required: true
        },
        {
          name: "Text",  // Changed from reveal_text
          type: "text",
          label: "Reveal Text",
          placeholder: "It's Here!",
          defaultValue: "It's Here!",
          maxLength: 25,
          scene: 3,
          required: true
        }
      ];
      
      // Update media slots to match base template expectations
      template.mediaSlots = [
        {
          name: "Video 1",  // Changed from teaser_media
          type: "video_or_image",
          scene: 1,
          label: "Teaser Background"
        },
        {
          name: "Video 2",  // Changed from countdown_bg
          type: "video_or_image",
          scene: 2,
          label: "Countdown Background"
        },
        {
          name: "Video 3",  // Changed from reveal_media
          type: "video_or_image",
          scene: 3,
          label: "Final Reveal Media"
        }
      ];
      
      await template.save();
      console.log('✅ Updated field and media slot names to match base template');
    }
    
    console.log('\n✨ Template update complete!');
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
updateCountdownTemplate();