const mongoose = require('mongoose');
const Template = require('../models/Template');
require('dotenv').config();

async function updateTemplateUrls() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veo5', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Update all templates to use SVG placeholders
    const templates = await Template.find({});
    
    for (const template of templates) {
      // Extract the base name from the current URL
      const previewBase = template.previewVideoUrl.split('/').pop().split('.')[0];
      const thumbBase = template.thumbnailUrl.split('/').pop().split('.')[0];
      
      // Update to SVG
      template.previewVideoUrl = `/templates/previews/${previewBase}.svg`;
      template.thumbnailUrl = `/templates/thumbs/${thumbBase}.svg`;
      
      await template.save();
      console.log(`✅ Updated URLs for: ${template.name}`);
    }
    
    console.log('\n✨ URL update complete!');
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
updateTemplateUrls();