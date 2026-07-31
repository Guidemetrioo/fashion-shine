async function runTest() {
  try {
    const payload = {
      name: "Brinco Argolinha Joiafina",
      sku: "2400002307496",
      basePrice: 25,
      mlStock: 1,
      publishToMeli: true,
      categoryId: "MLB1432", // Earrings (Brincos)
      withGemstone: "Sim",
      weight: 100,
      length: 16,
      width: 11,
      height: 2,
      condition: "new",
      listing_type_id: "gold_special", // Classic
      gtin: "Não se aplica",
      brand: "Fashion Shine",
      material: "estanho",
      color: "rodio negro",
      gender: "Feminino",
      sizes: "Único",
      imageUrl: "https://images.unsplash.com/photo-1635767798638-3e25273a8236?auto=format&fit=crop&w=400&q=80"
    };

    console.log('Sending product creation request to local server on port 3009...');
    const response = await fetch('http://localhost:3009/api/products/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Test execution failed:', error);
  }
}

runTest();
