const mongoose = require('mongoose');
const Template = require('../models/Template');
require('dotenv').config();

// CapCut-style video templates
const templates = [
  {
    name: "Dynamic Zoom Transition",
    description: "Smooth zoom transitions between media with dynamic text overlays",
    templateId: "dynamic-zoom-transition",
    previewVideoUrl: "/templates/previews/dynamic-zoom.svg",
    thumbnailUrl: "/templates/thumbs/dynamic-zoom.svg",
    scenes: 3,
    duration: 15,
    aspectRatio: "9:16",
    category: "social_media",
    tags: ["trending", "dynamic", "zoom", "transition"],
    fields: [
      {
        name: "title_text",
        type: "text",
        label: "Title Text",
        placeholder: "Enter your title",
        defaultValue: "Amazing Moments",
        maxLength: 30,
        scene: 1
      },
      {
        name: "subtitle_text",
        type: "text",
        label: "Subtitle",
        placeholder: "Enter subtitle",
        defaultValue: "Watch this!",
        maxLength: 50,
        scene: 2
      }
    ],
    mediaSlots: [
      {
        name: "media_1",
        type: "video_or_image",
        scene: 1,
        label: "First Media (Image/Video)"
      },
      {
        name: "media_2",
        type: "video_or_image",
        scene: 2,
        label: "Second Media (Image/Video)"
      },
      {
        name: "media_3",
        type: "video_or_image",
        scene: 3,
        label: "Third Media (Image/Video)"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30,
      elements: []
    }
  },
  {
    name: "Glitch Effect Showcase",
    description: "Modern glitch transitions with neon text effects",
    templateId: "glitch-effect-showcase",
    previewVideoUrl: "/templates/previews/glitch-effect.svg",
    thumbnailUrl: "/templates/thumbs/glitch-effect.svg",
    scenes: 2,
    duration: 10,
    aspectRatio: "9:16",
    category: "entertainment",
    tags: ["glitch", "neon", "modern", "effect"],
    fields: [
      {
        name: "main_text",
        type: "text",
        label: "Main Text",
        placeholder: "Your text here",
        defaultValue: "EPIC CONTENT",
        maxLength: 20,
        scene: 1
      },
      {
        name: "highlight_color",
        type: "color",
        label: "Highlight Color",
        defaultValue: "#FF00FF",
        scene: 1
      }
    ],
    mediaSlots: [
      {
        name: "background_media",
        type: "video_or_image",
        scene: 1,
        label: "Background Media"
      },
      {
        name: "overlay_media",
        type: "video_or_image",
        scene: 2,
        label: "Overlay Media"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Split Screen Story",
    description: "Tell your story with dynamic split-screen effects",
    templateId: "split-screen-story",
    previewVideoUrl: "/templates/previews/split-screen.svg",
    thumbnailUrl: "/templates/thumbs/split-screen.svg",
    scenes: 4,
    duration: 20,
    aspectRatio: "9:16",
    category: "social_media",
    tags: ["split", "story", "creative", "multiple"],
    fields: [
      {
        name: "story_title",
        type: "text",
        label: "Story Title",
        placeholder: "Your Story",
        defaultValue: "My Journey",
        maxLength: 25,
        scene: 1
      },
      {
        name: "scene_1_text",
        type: "text",
        label: "Scene 1 Caption",
        placeholder: "Caption",
        maxLength: 40,
        scene: 1
      },
      {
        name: "scene_2_text",
        type: "text",
        label: "Scene 2 Caption",
        placeholder: "Caption",
        maxLength: 40,
        scene: 2
      }
    ],
    mediaSlots: [
      {
        name: "top_media_1",
        type: "video_or_image",
        scene: 1,
        label: "Top Media Scene 1"
      },
      {
        name: "bottom_media_1",
        type: "video_or_image",
        scene: 1,
        label: "Bottom Media Scene 1"
      },
      {
        name: "top_media_2",
        type: "video_or_image",
        scene: 2,
        label: "Top Media Scene 2"
      },
      {
        name: "bottom_media_2",
        type: "video_or_image",
        scene: 2,
        label: "Bottom Media Scene 2"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Fast Beat Sync",
    description: "Quick cuts synced to beat drops with flashy transitions",
    templateId: "fast-beat-sync",
    previewVideoUrl: "/templates/previews/beat-sync.svg",
    thumbnailUrl: "/templates/thumbs/beat-sync.svg",
    scenes: 5,
    duration: 15,
    aspectRatio: "9:16",
    category: "entertainment",
    tags: ["music", "beat", "fast", "sync"],
    fields: [
      {
        name: "artist_name",
        type: "text",
        label: "Artist Name",
        placeholder: "Artist",
        defaultValue: "Featured Artist",
        maxLength: 30
      },
      {
        name: "track_name",
        type: "text",
        label: "Track Name",
        placeholder: "Track",
        defaultValue: "Hit Song",
        maxLength: 40
      }
    ],
    mediaSlots: [
      {
        name: "clip_1",
        type: "video_or_image",
        scene: 1,
        label: "Beat Drop 1"
      },
      {
        name: "clip_2",
        type: "video_or_image",
        scene: 2,
        label: "Beat Drop 2"
      },
      {
        name: "clip_3",
        type: "video_or_image",
        scene: 3,
        label: "Beat Drop 3"
      },
      {
        name: "clip_4",
        type: "video_or_image",
        scene: 4,
        label: "Beat Drop 4"
      },
      {
        name: "clip_5",
        type: "video_or_image",
        scene: 5,
        label: "Beat Drop 5"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Minimal Product Showcase",
    description: "Clean and minimal product presentation with smooth animations",
    templateId: "minimal-product-showcase",
    previewVideoUrl: "/templates/previews/minimal-product.svg",
    thumbnailUrl: "/templates/thumbs/minimal-product.svg",
    scenes: 3,
    duration: 12,
    aspectRatio: "9:16",
    category: "marketing",
    tags: ["product", "minimal", "clean", "business"],
    fields: [
      {
        name: "product_name",
        type: "text",
        label: "Product Name",
        placeholder: "Product",
        defaultValue: "Premium Product",
        maxLength: 30,
        scene: 1
      },
      {
        name: "product_price",
        type: "text",
        label: "Price",
        placeholder: "$99",
        defaultValue: "$99",
        maxLength: 10,
        scene: 2
      },
      {
        name: "cta_text",
        type: "text",
        label: "Call to Action",
        placeholder: "Shop Now",
        defaultValue: "Shop Now",
        maxLength: 20,
        scene: 3
      }
    ],
    mediaSlots: [
      {
        name: "product_hero",
        type: "video_or_image",
        scene: 1,
        label: "Hero Product Shot"
      },
      {
        name: "product_detail_1",
        type: "video_or_image",
        scene: 2,
        label: "Product Detail 1"
      },
      {
        name: "product_detail_2",
        type: "video_or_image",
        scene: 3,
        label: "Product Detail 2"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Before & After Transform",
    description: "Stunning before and after reveals with swipe transitions",
    templateId: "before-after-transform",
    previewVideoUrl: "/templates/previews/before-after.svg",
    thumbnailUrl: "/templates/thumbs/before-after.svg",
    scenes: 2,
    duration: 10,
    aspectRatio: "9:16",
    category: "business",
    tags: ["before", "after", "transformation", "reveal"],
    fields: [
      {
        name: "before_label",
        type: "text",
        label: "Before Label",
        placeholder: "BEFORE",
        defaultValue: "BEFORE",
        maxLength: 20,
        scene: 1
      },
      {
        name: "after_label",
        type: "text",
        label: "After Label",
        placeholder: "AFTER",
        defaultValue: "AFTER",
        maxLength: 20,
        scene: 2
      },
      {
        name: "result_text",
        type: "text",
        label: "Result Text",
        placeholder: "Amazing Results!",
        defaultValue: "Amazing Results!",
        maxLength: 30,
        scene: 2
      }
    ],
    mediaSlots: [
      {
        name: "before_media",
        type: "video_or_image",
        scene: 1,
        label: "Before Image/Video"
      },
      {
        name: "after_media",
        type: "video_or_image",
        scene: 2,
        label: "After Image/Video"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "3D Rotation Showcase",
    description: "Eye-catching 3D rotation effects for dynamic content",
    templateId: "3d-rotation-showcase",
    previewVideoUrl: "/templates/previews/3d-rotation.svg",
    thumbnailUrl: "/templates/thumbs/3d-rotation.svg",
    scenes: 3,
    duration: 12,
    aspectRatio: "9:16",
    category: "entertainment",
    tags: ["3d", "rotation", "dynamic", "modern"],
    fields: [
      {
        name: "intro_text",
        type: "text",
        label: "Intro Text",
        placeholder: "Get Ready",
        defaultValue: "Get Ready",
        maxLength: 25,
        scene: 1
      },
      {
        name: "main_message",
        type: "text",
        label: "Main Message",
        placeholder: "Your Message",
        defaultValue: "Something Amazing",
        maxLength: 40,
        scene: 2
      }
    ],
    mediaSlots: [
      {
        name: "front_media",
        type: "video_or_image",
        scene: 1,
        label: "Front Face Media"
      },
      {
        name: "side_media",
        type: "video_or_image",
        scene: 2,
        label: "Side Face Media"
      },
      {
        name: "back_media",
        type: "video_or_image",
        scene: 3,
        label: "Back Face Media"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Countdown Timer Launch",
    description: "Build excitement with animated countdown and reveal",
    templateId: "countdown-timer-launch",
    previewVideoUrl: "/templates/previews/countdown.svg",
    thumbnailUrl: "/templates/thumbs/countdown.svg",
    scenes: 3,
    duration: 10,
    aspectRatio: "9:16",
    category: "marketing",
    tags: ["countdown", "launch", "timer", "reveal"],
    fields: [
      {
        name: "event_name",
        type: "text",
        label: "Event Name",
        placeholder: "Big Launch",
        defaultValue: "Coming Soon",
        maxLength: 30,
        scene: 1
      },
      {
        name: "countdown_from",
        type: "text",
        label: "Countdown Start",
        placeholder: "3",
        defaultValue: "3",
        maxLength: 2,
        scene: 2
      },
      {
        name: "reveal_text",
        type: "text",
        label: "Reveal Text",
        placeholder: "It's Here!",
        defaultValue: "It's Here!",
        maxLength: 25,
        scene: 3
      }
    ],
    mediaSlots: [
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
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Text Message Story",
    description: "Tell stories through animated text message conversations",
    templateId: "text-message-story",
    previewVideoUrl: "/templates/previews/text-message.svg",
    thumbnailUrl: "/templates/thumbs/text-message.svg",
    scenes: 4,
    duration: 16,
    aspectRatio: "9:16",
    category: "social_media",
    tags: ["text", "message", "story", "chat"],
    fields: [
      {
        name: "sender_name",
        type: "text",
        label: "Sender Name",
        placeholder: "You",
        defaultValue: "You",
        maxLength: 20
      },
      {
        name: "message_1",
        type: "text",
        label: "Message 1",
        placeholder: "Hey!",
        defaultValue: "Guess what happened!",
        maxLength: 50,
        scene: 1
      },
      {
        name: "message_2",
        type: "text",
        label: "Message 2",
        placeholder: "What?",
        defaultValue: "What?",
        maxLength: 50,
        scene: 2
      },
      {
        name: "message_3",
        type: "text",
        label: "Message 3",
        placeholder: "Check this out!",
        defaultValue: "Check this out!",
        maxLength: 50,
        scene: 3
      }
    ],
    mediaSlots: [
      {
        name: "chat_background",
        type: "video_or_image",
        scene: 1,
        label: "Chat Background"
      },
      {
        name: "reaction_media",
        type: "video_or_image",
        scene: 4,
        label: "Reaction Media"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  },
  {
    name: "Parallax Photo Motion",
    description: "Create depth with parallax motion effects on photos",
    templateId: "parallax-photo-motion",
    previewVideoUrl: "/templates/previews/parallax.svg",
    thumbnailUrl: "/templates/thumbs/parallax.svg",
    scenes: 3,
    duration: 15,
    aspectRatio: "9:16",
    category: "entertainment",
    tags: ["parallax", "photo", "motion", "depth"],
    fields: [
      {
        name: "title_overlay",
        type: "text",
        label: "Title Overlay",
        placeholder: "Title",
        defaultValue: "Memories",
        maxLength: 25,
        scene: 1
      },
      {
        name: "location_text",
        type: "text",
        label: "Location",
        placeholder: "Location",
        defaultValue: "Paradise",
        maxLength: 30,
        scene: 2
      },
      {
        name: "date_text",
        type: "text",
        label: "Date",
        placeholder: "2024",
        defaultValue: "Summer 2024",
        maxLength: 20,
        scene: 3
      }
    ],
    mediaSlots: [
      {
        name: "foreground_1",
        type: "image",
        scene: 1,
        label: "Foreground Layer 1"
      },
      {
        name: "background_1",
        type: "image",
        scene: 1,
        label: "Background Layer 1"
      },
      {
        name: "foreground_2",
        type: "image",
        scene: 2,
        label: "Foreground Layer 2"
      },
      {
        name: "background_2",
        type: "image",
        scene: 2,
        label: "Background Layer 2"
      },
      {
        name: "final_image",
        type: "image",
        scene: 3,
        label: "Final Image"
      }
    ],
    creatomateConfig: {
      output_format: "mp4",
      width: 1080,
      height: 1920,
      frame_rate: 30
    }
  }
];

async function createTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/veo5', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Create templates
    for (const template of templates) {
      try {
        // Check if template already exists
        const existing = await Template.findOne({ templateId: template.templateId });
        
        if (existing) {
          console.log(`Template ${template.templateId} already exists, skipping...`);
          continue;
        }
        
        // Create new template
        const newTemplate = new Template(template);
        await newTemplate.save();
        
        console.log(`✅ Created template: ${template.name}`);
      } catch (error) {
        console.error(`❌ Error creating template ${template.name}:`, error.message);
      }
    }
    
    console.log('\n✨ Template creation complete!');
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTemplates();