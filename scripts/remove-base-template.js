const mongoose = require('mongoose');
const Template = require('../models/Template');
require('dotenv').config();

async function removeBaseTemplate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veo5', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Remove baseTemplateId from all templates
    const result = await Template.updateMany(
      {},
      { $unset: { baseTemplateId: "" } }
    );
    
    console.log(`✅ Removed baseTemplateId from ${result.modifiedCount} templates`);
    
    // Also revert the countdown template field names to our custom ones
    const countdown = await Template.findOne({ templateId: 'countdown-timer-launch' });
    if (countdown) {
      countdown.fields = [
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
          label: "Countdown Number",
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
      
      countdown.mediaSlots = [
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
      
      await countdown.save();
      console.log('✅ Reverted countdown template field names');
    }
    
    console.log('\n✨ Template cleanup complete!');
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
removeBaseTemplate();