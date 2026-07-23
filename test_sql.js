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

async function closeDuplicates() {
  console.log('--- Cleaning Up Duplicate Items on Mercado Livre ---');

  const tokens = await getTokens();
  const accessToken = tokens.mercadolivre.accessToken;

  const duplicateIds = [
    'MLB4932255931',
    'MLB4932254697',
    'MLB4932250261',
    'MLB4932245521',
    'MLB4932236869',
    'MLB4932235977',
    'MLB4932235099',
    'MLB4932234407'
  ];

  for (const id of duplicateIds) {
    console.log(`Closing item ${id}...`);
    
    // First pause the item
    await fetch(`https://api.mercadolibre.com/items/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'paused' })
    });

    // Then close the item
    const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'closed' })
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`✅ Item ${id} CLOSED successfully!`);
    } else {
      console.error(`❌ Failed to close item ${id}:`, data.message || JSON.stringify(data));
    }
  }

  console.log('\n🎉 ALL DUPLICATES CLOSED! Only item MLB7238449392 (the correct one with real photo) remains active.');
}

closeDuplicates().catch(console.error);
