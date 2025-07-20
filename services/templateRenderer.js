const axios = require('axios');

class TemplateRenderer {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.CREATOMATE_API_KEY;
    this.baseUrl = 'https://api.creatomate.com/v1';
  }

  /**
   * Prepare media URLs from user's Google Cloud Storage
   * @param {Array} mediaSlots - Template media slots configuration
   * @param {Object} userMedia - User's uploaded media URLs
   * @returns {Object} Modifications object for Creatomate
   */
  prepareMediaModifications(mediaSlots, userMedia) {
    const modifications = {};
    
    mediaSlots.forEach(slot => {
      if (userMedia[slot.name]) {
        // Ensure the URL is properly formatted for Creatomate
        const mediaUrl = userMedia[slot.name];
        
        // Check if it's a Google Cloud Storage URL
        if (mediaUrl.includes('storage.googleapis.com')) {
          modifications[slot.name] = {
            source: mediaUrl
          };
        } else {
          // Handle relative URLs or other formats
          modifications[slot.name] = {
            source: mediaUrl.startsWith('http') ? mediaUrl : `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${mediaUrl}`
          };
        }
      }
    });
    
    return modifications;
  }

  /**
   * Build Creatomate JSON configuration for templates
   * @param {Object} template - Template configuration from database
   * @param {Object} userInputs - User inputs (text, colors, media)
   * @returns {Object} Complete Creatomate JSON configuration
   */
  buildCreatomateConfig(template, userInputs) {
    // Prepare the media with proper URLs
    const preparedMedia = this.prepareMediaModifications(
      template.mediaSlots,
      userInputs.media || {}
    );
    
    const config = {
      output_format: "mp4",
      width: template.aspectRatio === "9:16" ? 1080 : 1920,
      height: template.aspectRatio === "9:16" ? 1920 : 1080,
      frame_rate: 30,
      duration: template.duration,
      elements: []
    };

    let elementIndex = 1;  // Track numbers must start at 1, not 0

    // Add background music if available
    const musicUrl = userInputs.media?.['Music.source'] || 
                    preparedMedia['Music.source']?.source ||
                    template.fields?.find(f => f.type === 'music')?.defaultValue;
    
    if (musicUrl) {
      config.elements.push({
        type: "audio",
        source: musicUrl,
        track: elementIndex++,
        time: 0,
        duration: null, // Use full audio duration
        audio_volume: 1, // Set to 1 for full volume
        loop: true // Loop if video is longer than audio
      });
    }

    // Process each scene
    for (let sceneIndex = 1; sceneIndex <= template.scenes; sceneIndex++) {
      const sceneStart = (sceneIndex - 1) * (template.duration / template.scenes);
      const sceneDuration = template.duration / template.scenes;

      // Add background color or gradient for each scene
      config.elements.push({
        type: "shape",
        shape: "rectangle",
        x: "50%",
        y: "50%",
        width: "100%",
        height: "100%",
        fill_color: this.getSceneBackgroundColor(template.templateId, sceneIndex),
        track: elementIndex++,
        time: sceneStart,
        duration: sceneDuration
      });

      // Add media elements for this scene
      template.mediaSlots
        .filter(slot => slot.scene === sceneIndex)
        .forEach((slot) => {
          const mediaUrl = preparedMedia[slot.name]?.source;
          if (mediaUrl) {
            const isVideo = slot.type === 'video' || (slot.type === 'video_or_image' && mediaUrl.includes('.mp4'));
            
            config.elements.push({
              type: isVideo ? 'video' : 'image',
              source: mediaUrl,
              track: elementIndex++,
              time: sceneStart,
              duration: isVideo ? null : sceneDuration,
              x: "50%",
              y: "50%",
              width: "100%",
              height: "100%",
              fill_mode: "cover",
              audio_volume: 0, // Mute video audio
              volume: 0, // Also try volume property
              animations: this.getMediaAnimations(template.templateId, sceneIndex)
            });
          }
        });

      // Add text elements for this scene
      template.fields
        .filter(field => field.scene === sceneIndex && field.type === 'text')
        .forEach((field) => {
          const textValue = userInputs.text?.[field.name] || field.defaultValue;
          if (textValue) {
            // Add text background shape if needed
            if (this.needsTextBackground(template.templateId, field.name)) {
              config.elements.push({
                type: "shape",
                shape: "rectangle",
                x: "50%",
                y: this.getTextPosition(template.templateId, field.name).y,
                width: "90%",
                height: "auto",
                fill_color: "rgba(0, 0, 0, 0.7)",
                track: elementIndex++,
                time: sceneStart,
                duration: sceneDuration,
                animations: this.getTextBackgroundAnimations(template.templateId, field.name)
              });
            }

            config.elements.push({
              type: "text",
              text: textValue,
              track: elementIndex++,
              time: sceneStart,
              duration: sceneDuration,
              ...this.getTextStyles(template.templateId, field.name),
              ...this.getTextPosition(template.templateId, field.name),
              animations: this.getTextAnimations(template.templateId, field.name)
            });
          }
        });

      // Add scene transitions
      if (sceneIndex < template.scenes) {
        this.addSceneTransition(config.elements, template.templateId, sceneStart + sceneDuration, elementIndex++);
      }
    }

    return config;
  }

  /**
   * Get scene background color
   */
  getSceneBackgroundColor(templateId, sceneIndex) {
    switch (templateId) {
      case 'countdown-timer-launch':
        return sceneIndex === 3 ? "#FF006E" : "#0a0a0a";
      case 'glitch-effect-showcase':
        return "#000000";
      case 'minimal-product-showcase':
        return "#FFFFFF";
      default:
        return "#0a0a0a";
    }
  }

  /**
   * Get text position based on template and field
   */
  getTextPosition(templateId, fieldName) {
    switch (templateId) {
      case 'countdown-timer-launch':
        if (fieldName === 'countdown_from' || fieldName === 'Subtitle') {
          return { x: "50%", y: "50%" };
        }
        return { x: "50%", y: "80%" };
      default:
        return { x: "50%", y: "50%" };
    }
  }

  /**
   * Check if text needs background
   */
  needsTextBackground(templateId, fieldName) {
    return ['countdown-timer-launch', 'text-message-story'].includes(templateId);
  }

  /**
   * Get text background animations
   */
  getTextBackgroundAnimations(templateId, fieldName) {
    return [
      {
        time: 0,
        duration: 0.3,
        type: "scale",
        from: { x: 0, y: 1 },
        to: { x: 1, y: 1 },
        transition: "smooth"
      }
    ];
  }

  /**
   * Add scene transition
   */
  addSceneTransition(elements, templateId, time, track) {
    // Add a wipe transition between scenes
    elements.push({
      type: "shape",
      shape: "rectangle",
      x: "-50%",
      y: "50%",
      width: "100%",
      height: "100%",
      fill_color: "#FFFFFF",
      track: track,
      time: time - 0.2,
      duration: 0.4,
      animations: [
        {
          time: 0,
          duration: 0.4,
          type: "wipe",
          from: "left"
        }
      ]
    });
  }

  /**
   * Get text styling based on template and field
   */
  getTextStyles(templateId, fieldName) {
    const baseStyles = {
      width: "80%",
      height: null, // auto height
      x_alignment: 50,  // 0 = left, 50 = center, 100 = right
      y_alignment: 50,  // 0 = top, 50 = center, 100 = bottom
      font_family: "Montserrat",
      font_weight: "700",
      font_size: "8vmin",  // Use viewport units
      fill_color: "#FFFFFF",
      shadow_color: "rgba(0,0,0,0.8)",
      shadow_blur: "10px"
    };

    // Customize based on template
    switch (templateId) {
      case 'countdown-timer-launch':
        if (fieldName === 'countdown_from' || fieldName === 'Subtitle') {
          return {
            ...baseStyles,
            font_size: "20vmin",
            font_family: "Bebas Neue"
          };
        }
        return baseStyles;
      case 'glitch-effect-showcase':
        return {
          ...baseStyles,
          font_family: "Bebas Neue",
          fill_color: "#FF00FF",
          stroke_color: "#00FFFF",
          stroke_width: "2px"
        };
      case 'minimal-product-showcase':
        return {
          ...baseStyles,
          font_family: "Helvetica",
          font_weight: "300",
          fill_color: "#000000",
          shadow_blur: "0px"  // Use 0px instead of null
        };
      default:
        return baseStyles;
    }
  }

  /**
   * Get animations for text elements
   */
  getTextAnimations(templateId, fieldName) {
    switch (templateId) {
      case 'countdown-timer-launch':
        if (fieldName === 'countdown_from' || fieldName === 'Subtitle') {
          // Big countdown number animation
          return [
            {
              time: 0,
              duration: 0.5,
              type: "scale",
              from: 3,
              to: 1,
              transition: "bounce"
            },
            {
              time: 0,
              duration: 0.5,
              type: "fade",
              from: 0,
              to: 1
            }
          ];
        }
        // Regular text fade in
        return [
          {
            time: 0,
            duration: 0.5,
            type: "slide",
            from: "bottom",
            transition: "smooth"
          },
          {
            time: 0,
            duration: 0.5,
            type: "fade",
            from: 0,
            to: 1
          }
        ];
      
      case 'glitch-effect-showcase':
        return [
          {
            time: 0,
            duration: 0.3,
            type: "fade",
            from: 0,
            to: 1
          },
          {
            time: 0.3,
            duration: 0.1,
            type: "shake",
            amplitude: 5
          }
        ];
        
      case '3d-rotation-showcase':
        return [
          {
            time: 0,
            duration: 1,
            type: "spin",
            from: -180,
            to: 0
          }
        ];
        
      default:
        // Default fade in animation
        return [
          {
            time: 0,
            duration: 0.5,
            type: "fade",
            from: 0,
            to: 1
          }
        ];
    }
  }

  /**
   * Get animations for media elements
   */
  getMediaAnimations(templateId, sceneIndex) {
    switch (templateId) {
      case 'dynamic-zoom-transition':
        return [
          {
            time: 0,
            duration: 3,
            type: "scale",
            from: 1,
            to: 1.2,
            transition: "smooth"
          }
        ];
        
      case 'countdown-timer-launch':
        // Subtle zoom for background media
        return [
          {
            time: 0,
            duration: 5,
            type: "scale",
            from: 1,
            to: 1.1,
            transition: "linear"
          }
        ];
        
      case 'parallax-photo-motion':
        return [
          {
            time: 0,
            duration: 5,
            type: "pan",
            from: "left",
            to: "right"
          }
        ];
        
      case '3d-rotation-showcase':
        return [
          {
            time: 0,
            duration: 1,
            type: "spin",
            from: -360,
            to: 0
          }
        ];
        
      default:
        // Default fade in for media
        return [
          {
            time: 0,
            duration: 0.3,
            type: "fade",
            from: 0,
            to: 1
          }
        ];
    }
  }

  /**
   * Render a video using a template source
   * @param {Object} templateConfig - Complete template configuration
   * @param {Object} userInputs - User inputs (text, media, colors)
   * @returns {Promise} Render response from Creatomate
   */
  async renderVideo(templateConfig, userInputs) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/renders`,
        {
          source: templateConfig,
          modifications: userInputs
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Template render error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check render status
   * @param {String} renderId - Render ID from Creatomate
   * @returns {Promise} Render status
   */
  async checkRenderStatus(renderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/renders/${renderId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Status check error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = TemplateRenderer;