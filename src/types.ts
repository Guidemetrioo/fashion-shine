export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  hoverImage: string;
  category: string;
  rating: number;
  sizes: string[];
  colors: string[];
  inStock: boolean;
  isNew?: boolean;
  isSale?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
}

export type Category = "all" | "dresses" | "outerwear" | "accessories" | "shoes";

// Integration Models
export interface ChannelOrder {
  id: string;
  orderId: string;
  buyerName: string;
  channel: "shopee" | "mercadolivre";
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: "pending" | "ready_to_ship" | "shipped" | "delivered";
  trackingCode: string;
  date: string;
}

export interface ChannelProduct {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  shopeeStock: number;
  shopeeSynced: boolean;
  mlStock: number;
  mlSynced: boolean;
  totalStock: number;
  lastSync: string;
  description?: string;
  imageUrl?: string;
  // Mercado Livre required API fields
  condition?: "new" | "used";
  listing_type_id?: string;
  gtin?: string;
  brand?: string;
  color?: string;
  gender?: string;
  sizes?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface IntegrationConfig {
  shopeeConnected: boolean;
  shopeeApiKey: string;
  mlConnected: boolean;
  mlApiKey: string;
  autoSync: boolean;
  syncInterval: number;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: "success" | "warning" | "error";
  message: string;
  channel: "shopee" | "mercadolivre" | "all";
}
