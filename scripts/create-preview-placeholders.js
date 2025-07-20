const fs = require('fs');
const path = require('path');

// Create placeholder preview files for templates
const templates = [
  'dynamic-zoom',
  'glitch-effect',
  'split-screen',
  'beat-sync',
  'minimal-product',
  'before-after',
  '3d-rotation',
  'countdown',
  'text-message',
  'parallax'
];

// SVG placeholder for video previews
const createVideoPlaceholder = (name) => `
<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8338EC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3A86FF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#grad1)"/>
  <text x="540" y="900" font-family="Arial, sans-serif" font-size="72" font-weight="bold" text-anchor="middle" fill="white">
    ${name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
  </text>
  <text x="540" y="1000" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="white" opacity="0.8">
    Template Preview
  </text>
  <circle cx="540" cy="1200" r="80" fill="white" opacity="0.9"/>
  <polygon points="520,1170 520,1230 580,1200" fill="#333"/>
</svg>
`;

// SVG placeholder for thumbnails
const createThumbnailPlaceholder = (name) => `
<svg width="540" height="960" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8338EC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3A86FF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="540" height="960" fill="url(#grad2)"/>
  <text x="270" y="450" font-family="Arial, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="white">
    ${name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
  </text>
  <circle cx="270" cy="600" r="40" fill="white" opacity="0.9"/>
  <polygon points="260,585 260,615 285,600" fill="#333"/>
</svg>
`;

// Create directories if they don't exist
const previewsDir = path.join(__dirname, '../public/templates/previews');
const thumbsDir = path.join(__dirname, '../public/templates/thumbs');

if (!fs.existsSync(previewsDir)) {
  fs.mkdirSync(previewsDir, { recursive: true });
}

if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Create placeholder files
templates.forEach(template => {
  // Create video preview placeholder (SVG)
  const videoPath = path.join(previewsDir, `${template}.svg`);
  fs.writeFileSync(videoPath, createVideoPlaceholder(template));
  console.log(`✅ Created preview: ${template}.svg`);
  
  // Create thumbnail placeholder (SVG)
  const thumbPath = path.join(thumbsDir, `${template}.svg`);
  fs.writeFileSync(thumbPath, createThumbnailPlaceholder(template));
  console.log(`✅ Created thumbnail: ${template}.svg`);
});

console.log('\n✨ Placeholder creation complete!');