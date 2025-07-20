const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  templateId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Preview
  previewVideoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  
  // Template Type
  templateType: {
    type: String,
    required: true,
    enum: ['json', 'creatomate'],
    default: 'json'
  },
  
  // For Creatomate templates - store the actual template ID
  creatomateTemplateId: {
    type: String,
    required: function() {
      return this.templateType === 'creatomate';
    }
  },
  
  // Template Configuration
  scenes: {
    type: Number,
    required: function() {
      return this.templateType === 'json';
    },
    min: 1,
    max: 20
  },
  duration: {
    type: Number,
    default: 30
  },
  aspectRatio: {
    type: String,
    default: '9:16',
    enum: ['9:16', '16:9', '1:1', '4:5']
  },
  
  // Dynamic Fields Configuration
  fields: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'media', 'color', 'music'],
      required: true
    },
    label: String,
    placeholder: String,
    defaultValue: String,
    required: {
      type: Boolean,
      default: true
    },
    maxLength: Number,
    scene: Number // Which scene this field belongs to (if applicable)
  }],
  
  // Media Requirements
  mediaSlots: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['video', 'image', 'video_or_image'],
      default: 'video_or_image'
    },
    scene: Number,
    label: String
  }],
  
  // Creatomate API Configuration
  creatomateConfig: {
    type: Object,
    default: {}
  },
  
  // Base Creatomate template UUID (optional)
  baseTemplateId: {
    type: String,
    default: null
  },
  
  // Metadata
  category: {
    type: String,
    enum: ['social_media', 'marketing', 'educational', 'entertainment', 'business', 'other'],
    default: 'other'
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  
  // Creator info
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
templateSchema.index({ templateId: 1 });
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ tags: 1 });

// Methods
templateSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

// Virtual for full configuration
templateSchema.virtual('fullConfig').get(function() {
  return {
    id: this.templateId,
    name: this.name,
    description: this.description,
    scenes: this.scenes,
    fields: this.fields,
    mediaSlots: this.mediaSlots,
    duration: this.duration,
    aspectRatio: this.aspectRatio
  };
});

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;