-- Tabela para salvar os tokens e chaves de APIs
CREATE TABLE IF NOT EXISTS integration_tokens (
    channel VARCHAR(50) PRIMARY KEY,
    connected BOOLEAN DEFAULT FALSE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at NUMERIC,
    user_id TEXT,
    nickname TEXT,
    client_id TEXT,
    client_secret TEXT,
    shop_id TEXT,
    partner_id TEXT,
    partner_key TEXT
);

-- Tabela para centralizar o estoque de produtos
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    name TEXT,
    sku VARCHAR(100) UNIQUE,
    base_price DECIMAL(10, 2),
    shopee_stock INTEGER DEFAULT 0,
    shopee_synced BOOLEAN DEFAULT FALSE,
    shopee_item_id VARCHAR(100),
    ml_stock INTEGER DEFAULT 0,
    ml_synced BOOLEAN DEFAULT FALSE,
    ml_item_id VARCHAR(100),
    total_stock INTEGER DEFAULT 0,
    last_sync VARCHAR(100),
    description TEXT,
    image_url TEXT
);

-- Tabela para logs e controle de duplicidade de pedidos
CREATE TABLE IF NOT EXISTS processed_orders (
    order_id VARCHAR(100) PRIMARY KEY
);
