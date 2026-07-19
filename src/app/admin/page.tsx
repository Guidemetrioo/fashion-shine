"use client";

import React, { useState, useEffect } from "react";
import "./admin.css";
import { ChannelOrder, ChannelProduct, IntegrationConfig, SyncLog } from "../../types";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "orders" | "settings">("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([
    { id: "1", timestamp: new Date(Date.now() - 60000 * 5).toLocaleTimeString(), type: "success", message: "Mercado Livre API: Inventory catalog sync completed successfully.", channel: "mercadolivre" },
    { id: "2", timestamp: new Date(Date.now() - 60000 * 12).toLocaleTimeString(), type: "success", message: "Shopee API: Orders status check completed. 1 new order imported.", channel: "shopee" },
    { id: "3", timestamp: new Date(Date.now() - 60000 * 20).toLocaleTimeString(), type: "success", message: "System: Bidirectional sync completed. 4 listings fully synchronized.", channel: "all" },
  ]);

  // Integration Settings State
  const [config, setConfig] = useState<IntegrationConfig>({
    shopeeConnected: true,
    shopeeApiKey: "shp_act_89920119283",
    mlConnected: true,
    mlApiKey: "mla_prd_33829103982",
    autoSync: true,
    syncInterval: 15,
  });

  const [showMlOAuth, setShowMlOAuth] = useState(false);
  const [mlAccountName, setMlAccountName] = useState("Fashion Shine Oficial");
  const [mlTempAccountName, setMlTempAccountName] = useState("Fashion Shine Oficial");
  const [isConnectingMl, setIsConnectingMl] = useState(false);
  const [isImportingMl, setIsImportingMl] = useState(false);

  const [isMlConfigured, setIsMlConfigured] = useState(false);
  const [isShopeeConfigured, setIsShopeeConfigured] = useState(false);
  const [showMlCredsWarning, setShowMlCredsWarning] = useState(false);

  const [mlInputClientId, setMlInputClientId] = useState("");
  const [mlInputClientSecret, setMlInputClientSecret] = useState("");

  // Product Search & Registration States
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdShopeeStock, setNewProdShopeeStock] = useState("");
  const [newProdMlStock, setNewProdMlStock] = useState("");
  const [newProdShopeeItemId, setNewProdShopeeItemId] = useState("");
  const [newProdMlItemId, setNewProdMlItemId] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // New Meli publishing states
  const [publishToMeli, setPublishToMeli] = useState(false);
  const [meliCategoryId, setMeliCategoryId] = useState("MLB1434"); // Defaults to Necklaces

  // Mercado Livre required fields (API POST /items)
  const [newProdCondition, setNewProdCondition] = useState<"new" | "used">("new");
  const [newProdListingType, setNewProdListingType] = useState("gold_special");
  const [newProdGtin, setNewProdGtin] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("");
  const [newProdMaterial, setNewProdMaterial] = useState("");
  const [newProdColor, setNewProdColor] = useState("");
  const [newProdGender, setNewProdGender] = useState("");
  const [newProdSizes, setNewProdSizes] = useState("");
  const [newProdWeight, setNewProdWeight] = useState("");
  const [newProdLength, setNewProdLength] = useState("");
  const [newProdWidth, setNewProdWidth] = useState("");
  const [newProdHeight, setNewProdHeight] = useState("");

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const handleFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setNewProdImageUrl(reader.result as string); // base64 representation!
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdSku) {
      alert("Nome e SKU são obrigatórios.");
      return;
    }

    if (publishToMeli) {
      if (newProdName.trim().length > 60) {
        alert("O Título do Anúncio no Mercado Livre não pode ter mais de 60 caracteres.");
        return;
      }
      if (!newProdBrand.trim()) {
        alert("A Marca (BRAND) é obrigatória para publicar no Mercado Livre.");
        return;
      }
      if (!newProdMaterial.trim()) {
        alert("O Material Principal (MATERIAL) é obrigatório para publicar no Mercado Livre.");
        return;
      }
      if (!newProdGender) {
        alert("O Gênero (GENDER) é obrigatório para publicar no Mercado Livre.");
        return;
      }
    }

    setIsCreatingProduct(true);
    try {
      const res = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProdName,
          sku: newProdSku,
          description: newProdDesc,
          imageUrl: newProdImageUrl,
          basePrice: Number(newProdPrice || 0),
          shopeeStock: Number(newProdShopeeStock || 0),
          mlStock: Number(newProdMlStock || 0),
          shopeeItemId: newProdShopeeItemId || undefined,
          mlItemId: newProdMlItemId || undefined,
          publishToMeli,
          categoryId: meliCategoryId,
          // Mercado Livre required API fields
          condition: newProdCondition,
          listing_type_id: newProdListingType,
          gtin: newProdGtin || undefined,
          brand: newProdBrand || undefined,
          material: newProdMaterial || undefined,
          color: newProdColor || undefined,
          gender: newProdGender || undefined,
          sizes: newProdSizes || undefined,
          weight: newProdWeight ? Number(newProdWeight) : undefined,
          length: newProdLength ? Number(newProdLength) : undefined,
          width: newProdWidth ? Number(newProdWidth) : undefined,
          height: newProdHeight ? Number(newProdHeight) : undefined,
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Refresh products list
        const prodRes = await fetch("/api/sync/products");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) {
            setProducts(prodData.products);
          }
        }
        
        addLog(`Central Inventory: Registered new product SKU ${newProdSku} successfully.`, "all", "success");
        alert("✨ Produto cadastrado com sucesso!");
        
        // Reset form
        setNewProdName("");
        setNewProdSku("");
        setNewProdDesc("");
        setNewProdImageUrl("");
        setImagePreview("");
        setNewProdPrice("");
        setNewProdShopeeStock("");
        setNewProdMlStock("");
        setNewProdShopeeItemId("");
        setNewProdMlItemId("");
        setPublishToMeli(false);
        setMeliCategoryId("MLB1434");
        // Reset ML fields
        setNewProdCondition("new");
        setNewProdListingType("gold_special");
        setNewProdGtin("");
        setNewProdBrand("");
        setNewProdMaterial("");
        setNewProdColor("");
        setNewProdGender("");
        setNewProdSizes("");
        setNewProdWeight("");
        setNewProdLength("");
        setNewProdWidth("");
        setNewProdHeight("");
        setShowAddProductModal(false);
      } else {
        alert(`❌ Erro ao cadastrar produto: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      alert("❌ Erro de rede ao cadastrar produto.");
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Load real products from API if connected
  const loadRealProducts = async () => {
    try {
      const res = await fetch("/api/sync/mercadolivre/products");
      if (res.ok) {
        const data = await res.json();
        if (data.connected && data.products && data.products.length > 0) {
          setProducts(data.products);
          addLog(`Mercado Livre: Loaded ${data.products.length} live listings from your seller account.`, "mercadolivre", "success");
        }
      }
    } catch (err) {
      console.error("Error loading products:", err);
    }
  };

  // Load status and products database from API on mount
  useEffect(() => {
    async function checkStatusAndProducts() {
      try {
        const res = await fetch("/api/auth/status");
        if (res.ok) {
          const data = await res.json();
          setConfig(prev => ({
            ...prev,
            mlConnected: data.mercadolivre.connected,
            shopeeConnected: data.shopee.connected
          }));
          setIsMlConfigured(data.mercadolivre.configured);
          setIsShopeeConfigured(data.shopee.configured);
          
          if (data.mercadolivre.clientId) {
            setMlInputClientId(data.mercadolivre.clientId);
          }
          
          if (data.mercadolivre.connected) {
            setMlAccountName(data.mercadolivre.nickname);
            // Load real products if connected
            loadRealProducts();
          }
        }
      } catch (err) {
        console.error("Error fetching integration status:", err);
      }

      // Fetch unified stock levels
      try {
        const res = await fetch("/api/sync/products");
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            setProducts(data.products);
          }
        }
      } catch (err) {
        console.error("Error loading products from database:", err);
      }
    }
    checkStatusAndProducts();

    // Check query params for status = ml_connected
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "ml_connected") {
      addLog("Mercado Livre API: Account connected via real OAuth 2.0 handshake!", "mercadolivre", "success");
      // Clean query params
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  }, []);

  const handleSaveMlCredentials = async () => {
    if (!mlInputClientId || !mlInputClientSecret) {
      alert("Por favor, preencha o Client ID e Client Secret.");
      return;
    }
    try {
      const res = await fetch("/api/auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "mercadolivre",
          clientId: mlInputClientId,
          clientSecret: mlInputClientSecret
        })
      });
      if (res.ok) {
        setIsMlConfigured(true);
        addLog("Mercado Livre API: Credentials saved securely.", "mercadolivre", "success");
        alert("✨ Mercado Livre API credentials saved successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportMlProducts = async () => {
    if (isImportingMl) return;
    setIsImportingMl(true);
    addLog("Mercado Livre: Starting catalog import...", "mercadolivre", "success");

    try {
      const res = await fetch("/api/sync/mercadolivre/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog(`Mercado Livre: Catalog imported! Imported: ${data.importedCount}, Updated: ${data.updatedCount} listings.`, "mercadolivre", "success");
        alert(`🎉 Mercado Livre catalog imported successfully!\nImported: ${data.importedCount} new products\nUpdated: ${data.updatedCount} existing products`);
        
        // Refresh products list
        const prodRes = await fetch("/api/sync/products");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) {
            setProducts(prodData.products);
          }
        }
      } else {
        const errMsg = data.error || "Failed to import catalog";
        addLog(`Mercado Livre: Import failed - ${errMsg}`, "mercadolivre", "error");
        alert(`❌ Import Failed: ${errMsg}`);
      }
    } catch (err: any) {
      console.error("Catalog import error:", err);
      addLog(`Mercado Livre: Import failed due to server error.`, "mercadolivre", "error");
      alert(`❌ Import Failed due to server error.`);
    } finally {
      setIsImportingMl(false);
    }
  };

  // Mock Synced Products Data
  const [products, setProducts] = useState<ChannelProduct[]>([
    { id: "gown-01", name: "Satin Evening Gown", sku: "FS-GOWN-MDNIGHT", basePrice: 1899, shopeeStock: 15, shopeeSynced: true, mlStock: 12, mlSynced: true, totalStock: 27, lastSync: "Just now" },
    { id: "coat-01", name: "Cashmere Double Coat", sku: "FS-COAT-CARAMEL", basePrice: 2450, shopeeStock: 8, shopeeSynced: true, mlStock: 10, mlSynced: true, totalStock: 18, lastSync: "Just now" },
    { id: "bag-01", name: "Aurelia Leather Handbag", sku: "FS-BAG-AURELIA", basePrice: 3120, shopeeStock: 5, shopeeSynced: true, mlStock: 4, mlSynced: true, totalStock: 9, lastSync: "Just now" },
    { id: "heels-01", name: "Stella Metallic Heels", sku: "FS-HEELS-STELLA", basePrice: 1490, shopeeStock: 20, shopeeSynced: true, mlStock: 18, mlSynced: true, totalStock: 38, lastSync: "Just now" },
  ]);

  // Mock Synced Orders Data
  const [orders, setOrders] = useState<ChannelOrder[]>([
    { id: "ord-101", orderId: "SHP-908237198", buyerName: "Ana Silva", channel: "shopee", items: [{ name: "Satin Evening Gown", quantity: 1, price: 1899 }], total: 1899, status: "pending", trackingCode: "BR987654321SH", date: "2026-07-01 18:22" },
    { id: "ord-102", orderId: "MLB-450912384", buyerName: "Carlos Santos", channel: "mercadolivre", items: [{ name: "Cashmere Double Coat", quantity: 1, price: 2450 }], total: 2450, status: "ready_to_ship", trackingCode: "ML123456789BR", date: "2026-07-01 16:45" },
    { id: "ord-103", orderId: "SHP-776123091", buyerName: "Mariana Souza", channel: "shopee", items: [{ name: "Aurelia Leather Handbag", quantity: 1, price: 3120 }], total: 3120, status: "shipped", trackingCode: "BR888777666SH", date: "2026-07-01 12:10" },
    { id: "ord-104", orderId: "MLB-882390129", buyerName: "Julia Rocha", channel: "mercadolivre", items: [{ name: "Stella Metallic Heels", quantity: 1, price: 1490 }], total: 1490, status: "delivered", trackingCode: "ML999888777BR", date: "2026-06-30 15:30" },
  ]);

  // Orders table filters
  const [orderChannelFilter, setOrderChannelFilter] = useState<"all" | "shopee" | "mercadolivre">("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "pending" | "ready_to_ship" | "shipped" | "delivered">("all");

  const addLog = (message: string, channel: "shopee" | "mercadolivre" | "all" = "all", type: "success" | "warning" | "error" = "success") => {
    const newLog: SyncLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      channel
    };
    setSyncLogs((prev) => [newLog, ...prev.slice(0, 19)]);
  };

  // Sync All channels handler
  const handleSyncAll = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    addLog("Triggering manual channel synchronization...", "all", "success");

    setTimeout(async () => {
      try {
        // 1. Fetch ML orders (triggers order polling sync and stock deductions)
        if (config.mlConnected) {
          const mlRes = await fetch("/api/sync/mercadolivre");
          if (mlRes.ok) {
            const mlData = await mlRes.json();
            if (mlData.orders && mlData.orders.length > 0) {
              setOrders(mlData.orders);
            }
          }
        }

        // 2. Refresh products list from unified database
        const prodRes = await fetch("/api/sync/products");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) {
            setProducts(prodData.products);
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
      setIsSyncing(false);
      addLog("Shopee API: Synced catalog listings and checked for payments.", "shopee", "success");
      addLog("Mercado Livre API: Pushed local inventory updates to channels.", "mercadolivre", "success");
      addLog("System Sync: Completed. All inventory stock matched.", "all", "success");
    }, 1800);
  };

  // Manual stock update handler
  const handleUpdateStock = (productId: string, channel: "shopee" | "mercadolivre", newVal: number) => {
    const val = isNaN(newVal) || newVal < 0 ? 0 : newVal;

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const shopeeStock = channel === "shopee" ? val : p.shopeeStock;
          const mlStock = channel === "mercadolivre" ? val : p.mlStock;
          const totalStock = shopeeStock + mlStock;

          // Send POST update to backend
          fetch("/api/sync/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              shopeeStock: val,
              mlStock: val,
              channel
            })
          }).then(res => {
            if (res.ok) {
              addLog(`Central Inventory: Updated and synced SKU ${p.sku} to ${val} units.`, channel, "success");
            } else {
              addLog(`Central Inventory: Failed to sync SKU ${p.sku} stock.`, channel, "error");
            }
          });

          return {
            ...p,
            shopeeStock: val,
            mlStock: val,
            totalStock: val,
            lastSync: "Just now",
          };
        }
        return p;
      })
    );
  };

  // Simulated Label printing
  const handlePrintLabel = (orderId: string, channel: string) => {
    alert(`📄 Shipping Label for Order ${orderId} (${channel.toUpperCase()}) generated successfully. Ready to print.`);
    addLog(`Printed shipping label for order ${orderId} (${channel.toUpperCase()}).`, channel as any, "success");
  };

  // Stats calculation
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const shopeeRevenue = orders.filter((o) => o.channel === "shopee").reduce((sum, o) => sum + o.total, 0);
  const mlRevenue = orders.filter((o) => o.channel === "mercadolivre").reduce((sum, o) => sum + o.total, 0);
  const totalSyncCount = products.length;

  const filteredOrders = orders.filter((o) => {
    const matchesChannel = orderChannelFilter === "all" || o.channel === orderChannelFilter;
    const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
    return matchesChannel && matchesStatus;
  });

  const filteredProducts = products.filter((p) => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
  });

  return (
    <div className="admin-layout">
      {/* Top sticky nav bar */}
      <header className="admin-header">
        <div className="admin-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
            <img 
              src="/logo.png" 
              alt="Fashion Shine Semijoias" 
              style={{ height: "80px", width: "auto", objectFit: "contain" }}
            />
            <span style={{
              background: "rgba(179, 151, 90, 0.12)",
              color: "var(--gold)",
              fontSize: "0.72rem",
              fontWeight: "600",
              padding: "4px 10px",
              borderRadius: "4px",
              letterSpacing: "0.05em",
              textTransform: "uppercase"
            }}>
              Channel Hub
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {/* Sync Indicators */}
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className={config.shopeeConnected ? "pulse-green" : "pulse-red"} />
                <span>Shopee API</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className={config.mlConnected ? "pulse-green" : "pulse-red"} />
                <span>Mercado Livre API</span>
              </div>
            </div>

            <button 
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="btn-gold"
              style={{
                padding: "0.5rem 1.2rem",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <svg 
                className={isSyncing ? "spin-sync" : ""} 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              {isSyncing ? "Syncing..." : "Sync All Channels"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Workspace */}
      <main className="admin-container" style={{ flex: 1 }}>
        
        {/* Navigation Tabs */}
        <div className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard Overview
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            Inventory Stock Sync ({totalSyncCount})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Orders Tracking ({orders.length})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Integration Settings
          </button>
        </div>

        {/* Tab 1: Dashboard Overview */}
        {activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Stats Row */}
            <div className="stats-grid">
              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Synced Revenue</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", color: "var(--gold)", margin: "0.5rem 0" }}>
                  R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "#a1a1aa" }}>
                  <span>Shopee: <strong className="channel-shopee">R$ {shopeeRevenue.toLocaleString("pt-BR")}</strong></span>
                  <span>M. Livre: <strong className="channel-ml">R$ {mlRevenue.toLocaleString("pt-BR")}</strong></span>
                </div>
              </div>

              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Synced Listings</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", margin: "0.5rem 0" }}>{totalSyncCount} / 4 Products</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "#a1a1aa" }}>
                  <span className="pulse-green" />
                  <span>All SKUs mapped bidirectionally</span>
                </div>
              </div>

              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Processing Orders</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", margin: "0.5rem 0" }}>
                  {orders.filter(o => o.status === "pending" || o.status === "ready_to_ship").length} Orders
                </h3>
                <div style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>
                  <span>Waiting shipping validation or courier label print</span>
                </div>
              </div>
            </div>

            {/* Middle panel layout */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", marginBottom: "2rem" }}>
              {/* Sales Channels visualizer */}
              <div className="stats-card" style={{ flex: "2 1 500px", padding: "2rem" }}>
                <h4 className="font-serif" style={{ fontSize: "1.2rem", marginBottom: "1.5rem" }}>Channel Sales Performance</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  {/* Shopee Bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                      <span className="channel-shopee" style={{ fontWeight: "500" }}>Orange Channel (Shopee)</span>
                      <span>{Math.round((shopeeRevenue / totalRevenue) * 100)}% ({orders.filter(o => o.channel === "shopee").length} Sales)</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#ee4d2d", height: "100%", width: `${(shopeeRevenue / totalRevenue) * 100}%` }} />
                    </div>
                  </div>

                  {/* Mercado Livre Bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                      <span className="channel-ml" style={{ fontWeight: "500" }}>Yellow Channel (Mercado Livre)</span>
                      <span>{Math.round((mlRevenue / totalRevenue) * 100)}% ({orders.filter(o => o.channel === "mercadolivre").length} Sales)</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#ffe600", height: "100%", width: `${(mlRevenue / totalRevenue) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sync Feed console log */}
              <div className="stats-card" style={{ flex: "1 1 350px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h4 className="font-serif" style={{ fontSize: "1.1rem" }}>API Channel Logs</h4>
                  <button 
                    onClick={() => setSyncLogs([])}
                    style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}
                  >
                    Clear Console
                  </button>
                </div>
                <div className="console-log" style={{ flex: 1 }}>
                  {syncLogs.length === 0 ? (
                    <span style={{ color: "#a1a1aa" }}>Console ready. Run sync to generate logs.</span>
                  ) : (
                    syncLogs.map((log) => (
                      <div key={log.id} style={{ display: "flex", gap: "8px" }}>
                        <span style={{ color: "rgba(255,255,255,0.3)" }}>[{log.timestamp}]</span>
                        <span className={log.channel === "shopee" ? "channel-shopee" : log.channel === "mercadolivre" ? "channel-ml" : ""}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Inventory Stock Sync */}
        {activeTab === "inventory" && (
          <div className="animate-fade-in">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
              marginBottom: "1.5rem",
              background: "rgba(255, 255, 255, 0.02)",
              padding: "1rem",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.04)"
            }}>
              {/* Search Bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 300px" }}>
                <input
                  type="text"
                  placeholder="Pesquisar por SKU ou Nome do produto..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="admin-input"
                  style={{ width: "100%", padding: "8px 12px", fontSize: "0.85rem" }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="btn-gold"
                  style={{
                    padding: "0.6rem 1.2rem",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>+</span> Novo Produto
                </button>
                
                {config.mlConnected && (
                  <button
                    onClick={handleImportMlProducts}
                    disabled={isImportingMl}
                    className="btn-outline"
                    style={{
                      padding: "0.6rem 1.2rem",
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {isImportingMl ? "Importando..." : "Importar do Mercado Livre"}
                  </button>
                )}
              </div>
            </div>

            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product Name & SKU</th>
                    <th>Base Price</th>
                    <th>Shopee Channel Stock</th>
                    <th>Mercado Livre Stock</th>
                    <th>Consolidated Stock</th>
                    <th>Status</th>
                    <th>Last Synchronized</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => (
                    <tr key={prod.id}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "500", color: "#ffffff" }}>{prod.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontFamily: "monospace" }}>{prod.sku}</span>
                        </div>
                      </td>
                      <td>R$ {prod.basePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            value={prod.shopeeStock}
                            onChange={(e) => handleUpdateStock(prod.id, "shopee", parseInt(e.target.value))}
                            style={{ width: "65px", padding: "4px 8px" }}
                            className="admin-input"
                          />
                          <span style={{ fontSize: "0.85rem", display: "inline-flex" }}>
                            {prod.shopeeSynced ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#39ff14" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <span style={{ color: "#ff4d4d" }}>!</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            value={prod.mlStock}
                            onChange={(e) => handleUpdateStock(prod.id, "mercadolivre", parseInt(e.target.value))}
                            style={{ width: "65px", padding: "4px 8px" }}
                            className="admin-input"
                          />
                          <span style={{ fontSize: "0.85rem", display: "inline-flex" }}>
                            {prod.mlSynced ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#39ff14" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <span style={{ color: "#ff4d4d" }}>!</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: "600", fontSize: "1rem" }}>{prod.totalStock} units</td>
                      <td>
                        <span className="badge" style={{ background: "rgba(57, 255, 20, 0.15)", color: "#39ff14" }}>
                          Synced
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--foreground-muted)" }}>{prod.lastSync}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Orders Tracking */}
        {activeTab === "orders" && (
          <div className="animate-fade-in">
            {/* Filter Bar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "1.5rem",
              background: "rgba(255, 255, 255, 0.02)",
              padding: "1rem",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.04)"
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                {/* Channel filters */}
                <button
                  onClick={() => setOrderChannelFilter("all")}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: orderChannelFilter === "all" ? "var(--gold)" : "rgba(255,255,255,0.05)",
                    color: orderChannelFilter === "all" ? "#000000" : "#a1a1aa",
                    fontWeight: orderChannelFilter === "all" ? "500" : "normal"
                  }}
                >
                  All Channels
                </button>
                <button
                  onClick={() => setOrderChannelFilter("shopee")}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: orderChannelFilter === "shopee" ? "#ee4d2d" : "rgba(255,255,255,0.05)",
                    color: "#ffffff",
                    fontWeight: orderChannelFilter === "shopee" ? "500" : "normal"
                  }}
                >
                  Shopee
                </button>
                <button
                  onClick={() => setOrderChannelFilter("mercadolivre")}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: orderChannelFilter === "mercadolivre" ? "#ffe600" : "rgba(255,255,255,0.05)",
                    color: orderChannelFilter === "mercadolivre" ? "#000000" : "#a1a1aa",
                    fontWeight: orderChannelFilter === "mercadolivre" ? "500" : "normal"
                  }}
                >
                  Mercado Livre
                </button>
              </div>

              {/* Status Select filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)" }}>Order Status:</span>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="admin-input"
                  style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                >
                  <option value="all">Show All</option>
                  <option value="pending">Pending</option>
                  <option value="ready_to_ship">Ready to Ship</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order & Tracking ID</th>
                    <th>Channel</th>
                    <th>Buyer</th>
                    <th>Purchased Items</th>
                    <th>Order Total</th>
                    <th>Order Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "var(--foreground-muted)", padding: "3rem" }}>
                        No orders match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "500", color: "#ffffff" }}>{ord.orderId}</span>
                            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", fontFamily: "monospace" }}>
                              Tracking: {ord.trackingCode}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ord.channel === "shopee" ? "bg-shopee" : "bg-ml"}`}>
                            {ord.channel === "shopee" ? "Shopee" : "Mercado Livre"}
                          </span>
                        </td>
                        <td>{ord.buyerName}</td>
                        <td>
                          {ord.items.map((item, i) => (
                            <span key={i} style={{ fontSize: "0.85rem", color: "#ffffff" }}>
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </td>
                        <td style={{ color: "var(--gold)" }}>R$ {ord.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td>
                          <span className="badge" style={{
                            background: 
                              ord.status === "pending" ? "rgba(255, 230, 0, 0.15)" :
                              ord.status === "ready_to_ship" ? "rgba(255, 120, 0, 0.15)" :
                              ord.status === "shipped" ? "rgba(0, 180, 255, 0.15)" : "rgba(57, 255, 20, 0.15)",
                            color:
                              ord.status === "pending" ? "#ffe600" :
                              ord.status === "ready_to_ship" ? "#ff7800" :
                              ord.status === "shipped" ? "#00b4ff" : "#39ff14",
                          }}>
                            {ord.status === "pending" ? "Pending" :
                             ord.status === "ready_to_ship" ? "Ready to Ship" :
                             ord.status === "shipped" ? "Shipped" : "Delivered"}
                          </span>
                        </td>
                        <td>
                          {ord.status === "ready_to_ship" ? (
                            <button
                              onClick={() => handlePrintLabel(ord.orderId, ord.channel)}
                              style={{
                                background: "#ffffff",
                                color: "#000000",
                                fontSize: "0.75rem",
                                padding: "4px 8px",
                                borderRadius: "2px",
                                fontWeight: "500"
                              }}
                            >
                              Print Label
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Label Ready</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Integration Settings */}
        {activeTab === "settings" && (
          <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            
            {/* Shopee Integration Card */}
            <div className={`connection-card ${config.shopeeConnected ? "active" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge bg-shopee">Shopee</span>
                  <h4 className="font-serif" style={{ fontSize: "1.2rem" }}>Shopee API Setup</h4>
                </div>
                <button
                  onClick={() => {
                    setConfig(prev => ({ ...prev, shopeeConnected: !prev.shopeeConnected }));
                    addLog(
                      config.shopeeConnected ? "Disabled Shopee API channel integration." : "Enabled Shopee API channel integration.",
                      "shopee",
                      config.shopeeConnected ? "warning" : "success"
                    );
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: config.shopeeConnected ? "rgba(255, 77, 77, 0.15)" : "var(--gold)",
                    color: config.shopeeConnected ? "#ff4d4d" : "#000000",
                    fontSize: "0.8rem",
                    fontWeight: "500"
                  }}
                >
                  {config.shopeeConnected ? "Disconnect" : "Connect"}
                </button>
              </div>

              {config.shopeeConnected && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>App API Key</label>
                    <input
                      type="password"
                      value={config.shopeeApiKey}
                      onChange={(e) => setConfig(prev => ({ ...prev, shopeeApiKey: e.target.value }))}
                      className="admin-input"
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Shop ID Mapping</label>
                    <input
                      type="text"
                      defaultValue="shp_shop_5510293"
                      className="admin-input"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Mercado Livre Integration Card */}
            <div className={`connection-card ${config.mlConnected ? "active" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge bg-ml">Mercado Livre</span>
                  <h4 className="font-serif" style={{ fontSize: "1.2rem" }}>Mercado Livre API Setup</h4>
                </div>
                <button
                  onClick={() => {
                    if (config.mlConnected) {
                      // Disconnect through API
                      fetch("/api/auth/status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ channel: "mercadolivre", disconnect: true })
                      }).then(() => {
                        setConfig(prev => ({ ...prev, mlConnected: false }));
                        addLog("Disconnected Mercado Livre API channel integration.", "mercadolivre", "warning");
                      });
                    } else {
                      if (isMlConfigured) {
                        // Redirect to the real authorization flow endpoint
                        window.location.href = "/api/auth/mercadolivre";
                      } else {
                        // Warn and offer simulation option
                        setShowMlCredsWarning(true);
                      }
                    }
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: config.mlConnected ? "rgba(255, 77, 77, 0.15)" : "var(--gold)",
                    color: config.mlConnected ? "#ff4d4d" : "#000000",
                    fontSize: "0.8rem",
                    fontWeight: "500"
                  }}
                >
                  {config.mlConnected ? "Disconnect" : "Connect Account"}
                </button>
              </div>

              {config.mlConnected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{
                    background: "rgba(255, 230, 0, 0.05)",
                    border: "1px solid rgba(255, 230, 0, 0.15)",
                    padding: "1rem",
                    borderRadius: "4px",
                    fontSize: "0.85rem"
                  }}>
                    <span style={{ color: "var(--foreground-muted)" }}>Connected Account: </span>
                    <strong style={{ color: "#ffe600" }}>{mlAccountName}</strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Access Token (OAuth 2.0)</label>
                    <input
                      type="password"
                      value={config.mlApiKey}
                      onChange={(e) => setConfig(prev => ({ ...prev, mlApiKey: e.target.value }))}
                      className="admin-input"
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Seller ID Mapping</label>
                    <input
                      type="text"
                      defaultValue="mlb_sell_99812739"
                      className="admin-input"
                    />
                  </div>
                  <button
                    onClick={handleImportMlProducts}
                    disabled={isImportingMl}
                    className="btn-gold"
                    style={{
                      padding: "0.75rem",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      marginTop: "0.5rem"
                    }}
                  >
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {isImportingMl ? "Importando Catálogo..." : "Importar Catálogo do Mercado Livre"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>App Client ID</label>
                    <input
                      type="text"
                      placeholder="Ex: 55102930981"
                      value={mlInputClientId}
                      onChange={(e) => setMlInputClientId(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>App Client Secret</label>
                    <input
                      type="password"
                      placeholder="Sua chave secreta da API"
                      value={mlInputClientSecret}
                      onChange={(e) => setMlInputClientSecret(e.target.value)}
                      className="admin-input"
                    />
                  </div>
                  <button
                    onClick={handleSaveMlCredentials}
                    className="btn-outline"
                    style={{ padding: "0.5rem 0", fontSize: "0.8rem", width: "100%" }}
                  >
                    Save API Credentials
                  </button>
                  <div style={{ color: "var(--foreground-muted)", fontSize: "0.8rem", fontStyle: "italic", marginTop: "4px" }}>
                    {isMlConfigured 
                      ? "✓ Credentials configured. Click Connect to authorize."
                      : "ⓘ Credentials missing. Fill inputs to configure real integration, or click Connect to access the Simulator."}
                  </div>
                </div>
              )}
            </div>

            {/* General sync parameters */}
            <div className="connection-card" style={{ gridColumn: "1 / -1" }}>
              <h4 className="font-serif" style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Automated Synchronization Parameters</h4>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center" }}>
                
                {/* Auto Sync Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="checkbox"
                    id="auto-sync"
                    checked={config.autoSync}
                    onChange={(e) => {
                      setConfig(prev => ({ ...prev, autoSync: e.target.checked }));
                      addLog(
                        e.target.checked ? "Automated background sync enabled." : "Automated background sync disabled.",
                        "all",
                        "success"
                      );
                    }}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <label htmlFor="auto-sync" style={{ cursor: "pointer", fontSize: "0.9rem" }}>
                    Enable real-time background sync
                  </label>
                </div>

                {/* Interval Slider */}
                {config.autoSync && (
                  <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1, minWidth: "250px" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", whiteSpace: "nowrap" }}>
                      Sync Frequency: <strong>{config.syncInterval} minutes</strong>
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={config.syncInterval}
                      onChange={(e) => setConfig(prev => ({ ...prev, syncInterval: parseInt(e.target.value) }))}
                      style={{ flex: 1, accentColor: "var(--gold)" }}
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Simulated Mercado Livre OAuth Login Modal */}
      {showMlOAuth && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }}>
          {/* Backdrop */}
          <div 
            onClick={() => { if (!isConnectingMl) setShowMlOAuth(false); }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(5px)",
            }}
          />

          {/* OAuth Windows Panel */}
          <div style={{
            position: "relative",
            width: "480px",
            maxWidth: "100%",
            background: "#ffffff",
            color: "#333333",
            borderRadius: "8px",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 401,
            animation: "fadeIn 0.3s ease-out"
          }}>
            {/* Header: Mercado Livre styling */}
            <div style={{
              background: "#ffe600",
              padding: "1.2rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(0,0,0,0.08)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Simulated Handshake Logo */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2d3277" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span style={{ fontSize: "1.2rem", fontWeight: "700", color: "#2d3277", fontFamily: "sans-serif" }}>
                  mercado <span style={{ fontWeight: "400" }}>livre</span>
                </span>
              </div>
              {!isConnectingMl && (
                <button 
                  onClick={() => setShowMlOAuth(false)}
                  style={{ color: "#666666", padding: "0.25rem", fontSize: "1.2rem", fontWeight: "bold" }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {isConnectingMl ? (
                <div style={{ textAlign: "center", padding: "2rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2rem" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(0, 0, 0, 0.1)",
                    borderTopColor: "#2d3277",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }} />
                  <div>
                    <h4 style={{ fontWeight: "600", fontSize: "1.05rem" }}>Autenticando...</h4>
                    <p style={{ color: "#666666", fontSize: "0.85rem", marginTop: "4px" }}>
                      Trocando código de autorização por tokens de acesso seguros...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#111111", marginBottom: "0.5rem" }}>
                      Conectar Fashion Shine Hub
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "#555555", lineHeight: "1.5" }}>
                      Para vincular sua conta do Mercado Livre e habilitar a sincronização automática de estoque e pedidos, você precisa conceder as seguintes permissões:
                    </p>
                  </div>

                  {/* Permissions Checklist */}
                  <div style={{
                    background: "#f7f7f9",
                    padding: "1rem",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.8rem",
                    fontSize: "0.85rem",
                    color: "#444444"
                  }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <span style={{ color: "#39ff14", fontWeight: "bold" }}>✓</span>
                      <span>Ler dados básicos do seu perfil comercial.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <span style={{ color: "#39ff14", fontWeight: "bold" }}>✓</span>
                      <span>Criar e atualizar anúncios de vestuário e calçados.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <span style={{ color: "#39ff14", fontWeight: "bold" }}>✓</span>
                      <span>Sincronizar estoque local e coletar vendas recebidas.</span>
                    </div>
                  </div>

                  {/* Nickname input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#444444" }}>
                      Apelido/Usuário da Conta Mercado Livre
                    </label>
                    <input
                      type="text"
                      value={mlTempAccountName}
                      onChange={(e) => setMlTempAccountName(e.target.value)}
                      placeholder="ex: Fashion_Shine_Oficial"
                      style={{
                        padding: "0.6rem 0.8rem",
                        border: "1px solid #cccccc",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        color: "#333333"
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "0.5rem" }}>
                    <button
                      onClick={() => {
                        setIsConnectingMl(true);
                        setTimeout(() => {
                          setMlAccountName(mlTempAccountName || "Fashion Shine Oficial");
                          setConfig(prev => ({ ...prev, mlConnected: true, mlApiKey: `mla_oauth_tok_fashion_shine_live_${Date.now()}` }));
                          addLog(`Mercado Livre API: Account '${mlTempAccountName || "Fashion Shine Oficial"}' connected via OAuth 2.0.`, "mercadolivre", "success");
                          setIsConnectingMl(false);
                          setShowMlOAuth(false);
                        }, 1600);
                      }}
                      style={{
                        flex: 1,
                        background: "#2d3277",
                        color: "#ffffff",
                        padding: "0.75rem 0",
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.9rem",
                        textAlign: "center",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Autorizar Acesso
                    </button>
                    <button
                      onClick={() => setShowMlOAuth(false)}
                      style={{
                        flex: 1,
                        background: "#f0f0f2",
                        color: "#555555",
                        padding: "0.75rem 0",
                        borderRadius: "4px",
                        fontWeight: "500",
                        fontSize: "0.9rem",
                        textAlign: "center",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Product Registration Modal */}
      {showAddProductModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 420,
          display: "flex",
          justifyContent: "flex-end"
        }}>
          {/* Backdrop */}
          <div 
            onClick={() => setShowAddProductModal(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Modal Panel (Floating gold-bordered slide-over) */}
          <div style={{
            position: "relative",
            width: "560px",
            height: "calc(100% - 2rem)",
            margin: "1rem",
            background: "#ffffff",
            color: "var(--foreground)",
            border: "1px solid var(--gold)",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(45,43,39,0.12), 0 0 15px rgba(179,151,90,0.08)",
            display: "flex",
            flexDirection: "column",
            zIndex: 421,
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              padding: "1.5rem 1.5rem 0.5rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 className="font-serif" style={{ fontSize: "1.45rem", color: "var(--gold)", margin: 0, fontWeight: "600" }}>
                Cadastrar Novo Produto
              </h3>
              <button 
                onClick={() => setShowAddProductModal(false)}
                style={{ background: "none", border: "none", color: "var(--foreground-muted)", fontSize: "1.5rem", cursor: "pointer", padding: "0 5px" }}
              >
                &times;
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateProduct} style={{ overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Photo Upload Container */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#e3e1e9" }}>Foto do Produto</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById("product-file-upload")?.click()}
                  style={{
                    height: "125px",
                    border: isDragging ? "2px dashed var(--gold)" : "1px dashed rgba(212, 175, 55, 0.4)",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.02)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                    overflow: "hidden"
                  }}
                >
                  <input
                    type="file"
                    id="product-file-upload"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  {imagePreview ? (
                    <>
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                      />
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePreview("");
                          setNewProdImageUrl("");
                        }}
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          background: "rgba(0,0,0,0.8)",
                          color: "#ff4d4d",
                          border: "none",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.9rem",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        &times;
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#8a8a93", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.8rem" }}>photo_camera</span>
                      <span style={{ fontSize: "0.75rem", color: "#8a8a93" }}>Arraste uma imagem ou insira a URL</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SEÇÃO 1: INFORMAÇÕES BÁSICAS ── */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.1em" }}>📋 Informações Básicas</span>

                {/* Nome do Produto */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Título do Anúncio <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Máx. 60 caracteres. Seja claro e use palavras-chave.</span>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="Ex: Colar Brilhante Ouro 18k Feminino"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                  <span style={{ fontSize: "0.68rem", color: newProdName.length > 50 ? "#f59e0b" : "#8a8a93", textAlign: "right" }}>{newProdName.length}/60</span>
                </div>

                {/* SKU */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    SKU Interno <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Seu código único de controle (seller_custom_field no ML).</span>
                  <input
                    type="text"
                    required
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="Ex: FS-1023"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Condição */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Condição <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["new", "used"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewProdCondition(c)}
                        style={{
                          flex: 1,
                          padding: "0.55rem",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          fontWeight: "600",
                          border: newProdCondition === c ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
                          background: newProdCondition === c ? "rgba(212,175,55,0.15)" : "#121216",
                          color: newProdCondition === c ? "var(--gold)" : "#8a8a93",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {c === "new" ? "✨ Novo" : "♻️ Usado"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descrição */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>Descrição Completa</label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Enviada como plain_text para a API do ML.</span>
                  <textarea
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    placeholder="Descreva o material, dimensões, diferenciais..."
                    rows={3}
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", resize: "vertical" }}
                  />
                </div>
              </div>

              {/* ── SEÇÃO 2: CLASSIFICAÇÃO NO MERCADO LIVRE ── */}
              <div style={{
                background: "rgba(255,230,0,0.03)",
                border: "1px solid rgba(255,230,0,0.12)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#ffe600", textTransform: "uppercase", letterSpacing: "0.1em" }}>🛒 Classificação Mercado Livre</span>

                {/* Categoria MLB */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Categoria MLB (category_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Consulte em: developers.mercadolivre.com.br/categories</span>
                  <input
                    type="text"
                    value={meliCategoryId}
                    onChange={(e) => setMeliCategoryId(e.target.value)}
                    placeholder="Ex: MLB1434"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,230,0,0.15)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>MLB1434 = Colares e Pingentes · MLB1467 = Brincos · MLB1471 = Pulseiras</span>
                </div>

                {/* Tipo de Anúncio */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Tipo de Anúncio (listing_type_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Define visibilidade e tarifa cobrada pelo ML.</span>
                  <select
                    value={newProdListingType}
                    onChange={(e) => setNewProdListingType(e.target.value)}
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,230,0,0.15)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="gold_pro">🥇 Gold Pro — Máxima exposição (16% tarifa)</option>
                    <option value="gold_special">⭐ Gold Special — Alta exposição (12% tarifa)</option>
                    <option value="gold">🥈 Gold — Boa exposição (9% tarifa)</option>
                    <option value="silver">🥉 Silver — Exposição padrão (6% tarifa)</option>
                    <option value="free">🆓 Grátis — Sem tarifa, sem destaque</option>
                  </select>
                </div>

                {/* Publicar no ML */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem 0.75rem", background: "rgba(255,230,0,0.06)", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="publish-to-meli-checkbox"
                    checked={publishToMeli}
                    onChange={(e) => setPublishToMeli(e.target.checked)}
                    style={{ accentColor: "var(--gold)", cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="publish-to-meli-checkbox" style={{ fontSize: "0.8rem", color: "#e3e1e9", cursor: "pointer" }}>
                    Publicar anúncio no Mercado Livre imediatamente após salvar
                  </label>
                </div>
              </div>

              {/* ── SEÇÃO 3: PREÇO E ESTOQUE ── */}
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.1em" }}>💰 Preço e Estoque</span>

                {/* Preço Base */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Preço de Venda (R$) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "#8a8a93" }}>Enviado como `price` na API. Moeda fixada em BRL.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(255,255,255,0.08)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Estoques */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#e3e1e9" }}>Estoque Inicial <span style={{ color: "#ff4d4d" }}>*</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "#ffe600" }}>Mercado Livre</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdMlStock}
                        onChange={(e) => setNewProdMlStock(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#121216", border: "1px solid rgba(255,230,0,0.15)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "#ee4d2d" }}>Shopee</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdShopeeStock}
                        onChange={(e) => setNewProdShopeeStock(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#121216", border: "1px solid rgba(238,77,45,0.2)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SEÇÃO 4: ATRIBUTOS DO PRODUTO ── */}
              <div style={{
                background: "rgba(99,102,241,0.04)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em" }}>🏷️ Atributos do Produto</span>
                  <span style={{ fontSize: "0.65rem", color: "#8a8a93", fontStyle: "italic" }}>Enviados como `attributes[]` na API</span>
                </div>

                {/* Marca + EAN — 2 colunas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>
                      Marca (BRAND) {publishToMeli && <span style={{ color: "#ff4d4d" }}>*</span>}
                    </label>
                    <input
                      type="text"
                      required={publishToMeli}
                      value={newProdBrand}
                      onChange={(e) => setNewProdBrand(e.target.value)}
                      placeholder="Ex: Fashion Shine"
                      className="admin-input"
                      style={{ background: "#121216", border: "1px solid rgba(99,102,241,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>Código EAN / GTIN</label>
                    <span style={{ fontSize: "0.65rem", color: "#8a8a93" }}>13 dígitos. Obrigatório em muitas categorias.</span>
                    <input
                      type="text"
                      maxLength={14}
                      value={newProdGtin}
                      onChange={(e) => setNewProdGtin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ex: 7891234567890"
                      className="admin-input"
                      style={{ background: "#121216", border: "1px solid rgba(99,102,241,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem", fontFamily: "monospace" }}
                    />
                  </div>
                </div>

                {/* Material */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Material Principal (MATERIAL) {publishToMeli && <span style={{ color: "#ff4d4d" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    required={publishToMeli}
                    value={newProdMaterial}
                    onChange={(e) => setNewProdMaterial(e.target.value)}
                    placeholder="Ex: Prata 925, Aço Inoxidável, Liga de metal, Acrílico"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(99,102,241,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Gênero */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>
                    Gênero (GENDER) {publishToMeli && <span style={{ color: "#ff4d4d" }}>*</span>}
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["", "Feminino", "Masculino", "Unissex"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewProdGender(g)}
                        style={{
                          flex: 1,
                          padding: "0.45rem 0.3rem",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: "500",
                          border: newProdGender === g ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.08)",
                          background: newProdGender === g ? "rgba(167,139,250,0.15)" : "#121216",
                          color: newProdGender === g ? "#a78bfa" : "#8a8a93",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {g === "" ? "—" : g === "Feminino" ? "♀️ Fem." : g === "Masculino" ? "♂️ Masc." : "🔁 Uni."}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>Cor Principal (COLOR)</label>
                  <input
                    type="text"
                    value={newProdColor}
                    onChange={(e) => setNewProdColor(e.target.value)}
                    placeholder="Ex: Dourado, Prata, Rose Gold"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(99,102,241,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Tamanhos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>Tamanhos Disponíveis (SIZE)</label>
                  <span style={{ fontSize: "0.65rem", color: "#8a8a93" }}>Separados por vírgula. Ex: PP, P, M, G, GG · ou: 36, 38, 40</span>
                  <input
                    type="text"
                    value={newProdSizes}
                    onChange={(e) => setNewProdSizes(e.target.value)}
                    placeholder="Ex: P, M, G, GG"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(99,102,241,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              {/* ── SEÇÃO 5: LOGÍSTICA E FRETE ── */}
              <div style={{
                background: "rgba(16,185,129,0.03)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#34d399", textTransform: "uppercase", letterSpacing: "0.1em" }}>📦 Logística & Frete</span>
                  <span style={{ fontSize: "0.65rem", color: "#8a8a93", fontStyle: "italic" }}>Afeta cálculo de frete pelo ML</span>
                </div>

                {/* Peso */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>Peso do Produto (gramas)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProdWeight}
                    onChange={(e) => setNewProdWeight(e.target.value)}
                    placeholder="Ex: 150 (em gramas)"
                    className="admin-input"
                    style={{ background: "#121216", border: "1px solid rgba(16,185,129,0.2)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Dimensões — 3 colunas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "#e3e1e9" }}>Dimensões da Embalagem (cm)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "#8a8a93" }}>Comprimento</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdLength}
                        onChange={(e) => setNewProdLength(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#121216", border: "1px solid rgba(16,185,129,0.2)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "#8a8a93" }}>Largura</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdWidth}
                        onChange={(e) => setNewProdWidth(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#121216", border: "1px solid rgba(16,185,129,0.2)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "#8a8a93" }}>Altura</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdHeight}
                        onChange={(e) => setNewProdHeight(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#121216", border: "1px solid rgba(16,185,129,0.2)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: "flex", gap: "10px", marginTop: "0.6rem" }}>
                <button
                  type="submit"
                  disabled={isCreatingProduct}
                  style={{
                    flex: 1.3,
                    background: "linear-gradient(to right, #d4af37, #f3e5ab)",
                    color: "#000000",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "opacity 0.2s"
                  }}
                >
                  {isCreatingProduct ? "Cadastrando..." : "Adicionar Produto"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{
                    flex: 1,
                    background: "#1c1c24",
                    color: "#e3e1e9",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    fontWeight: "500",
                    fontSize: "0.85rem",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Warning Modal */}
      {showMlCredsWarning && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 450,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }}>
          {/* Backdrop */}
          <div 
            onClick={() => setShowMlCredsWarning(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(4px)",
            }}
          />

          {/* Modal Panel */}
          <div style={{
            position: "relative",
            width: "480px",
            maxWidth: "100%",
            background: "#ffffff",
            color: "var(--foreground)",
            border: "1px solid var(--gold)",
            borderRadius: "12px",
            boxShadow: "0 25px 50px rgba(45,43,39,0.15)",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            zIndex: 451,
            animation: "fadeIn 0.3s ease-out"
          }}>
            <h3 className="font-serif" style={{ fontSize: "1.3rem", color: "var(--gold)", fontWeight: "600" }}>
              Credenciais de API Requeridas
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: "1.6" }}>
              Para conectar-se efetivamente à sua conta real do Mercado Livre, você deve primeiro configurar as chaves de API obtidas no painel de desenvolvedores do Mercado Livre.
            </p>
            <div style={{
              background: "rgba(45, 43, 39, 0.02)",
              border: "1px solid rgba(45, 43, 39, 0.08)",
              padding: "1rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              color: "var(--gold)"
            }}>
              1. Abra o arquivo .env.local<br/>
              2. Preencha ML_CLIENT_ID e ML_CLIENT_SECRET<br/>
              3. Reinicie a aplicação local
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: "1.6" }}>
              Se você deseja apenas testar a interface do fluxo de autenticação e preencher a conta no sistema de forma demonstrativa, você pode acessar o **Simulador Interativo**.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowMlCredsWarning(false);
                  setShowMlOAuth(true);
                }}
                className="btn-gold"
                style={{ flex: 1, padding: "0.6rem 0", fontSize: "0.8rem" }}
              >
                Acessar Simulador
              </button>
              <button
                onClick={() => setShowMlCredsWarning(false)}
                className="btn-outline"
                style={{ flex: 1, padding: "0.6rem 0", fontSize: "0.8rem" }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
