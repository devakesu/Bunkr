const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateBlurPlaceholder() {
  const inputPath = path.join(__dirname, '../public/logo.png');
  
  const buffer = await sharp(inputPath)
    .resize(20, 20, { fit: 'inside' })
    .blur(1)
    .toBuffer();
  
  const base64 = buffer.toString('base64');
  console.log('\n✅ Add this to your Image component:');
  console.log(`\nblurDataURL="data:image/png;base64,${base64}"\n`);
}

generateBlurPlaceholder().catch(console.error);