const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) {
    process.env[m[1].trim()] = m[2].trim();
  }
});

const { getTokens } = require('./src/utils/tokenStorage');

async function uploadPictureAndUpdateItem() {
  console.log('--- Uploading Picture directly to Mercado Livre API ---');

  const tokens = await getTokens();
  const accessToken = tokens.mercadolivre.accessToken;

  const imagePath = 'C:\\Users\\guide\\.gemini\\antigravity-ide\\brain\\c9dd3c74-5fb4-4d53-bd28-c3f74663a6d6\\media__1784833218002.jpg';
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

  const formData = new FormData();
  formData.append('file', blob, 'brinco-argolinha.jpg');

  const uploadRes = await fetch('https://api.mercadolibre.com/pictures/items/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  });

  const uploadData = await uploadRes.json();
  console.log('Upload Response:', JSON.stringify(uploadData, null, 2));

  if (uploadData.id) {
    const pictureId = uploadData.id;
    console.log('🎉 Uploaded Picture ID:', pictureId);

    // Update item MLB7238449392 with the new picture ID
    const updateRes = await fetch('https://api.mercadolibre.com/items/MLB7238449392', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pictures: [
          { id: pictureId }
        ]
      })
    });

    const updateData = await updateRes.json();
    console.log('Item Update Response:', JSON.stringify(updateData, null, 2));
    if (updateRes.ok) {
      console.log('🎉 ITEM MLB7238449392 UPDATED WITH REAL EARRING PHOTO!');
    }
  }
}

uploadPictureAndUpdateItem().catch(console.error);
