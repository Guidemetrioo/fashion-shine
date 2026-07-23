"use client";

import React, { useState, useEffect } from "react";
import "./admin.css";
import { ChannelOrder, ChannelProduct, IntegrationConfig, SyncLog } from "../../types";



export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "orders" | "settings">("dashboard");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Integration Settings State
  const [config, setConfig] = useState<IntegrationConfig>({
    shopeeConnected: false,
    shopeeApiKey: "",
    mlConnected: false,
    mlApiKey: "",
    autoSync: true,
    syncInterval: 15,
  });

  const [showMlOAuth, setShowMlOAuth] = useState(false);
  const [mlAccountName, setMlAccountName] = useState("Desconectado");
  const [mlTempAccountName, setMlTempAccountName] = useState("Desconectado");
  const [isConnectingMl, setIsConnectingMl] = useState(false);
  const [isImportingMl, setIsImportingMl] = useState(false);

  const [isMlConfigured, setIsMlConfigured] = useState(false);
  const [isShopeeConfigured, setIsShopeeConfigured] = useState(false);
  const [showMlCredsWarning, setShowMlCredsWarning] = useState(false);
  const [showShopeeCredsWarning, setShowShopeeCredsWarning] = useState(false);

  const [mlInputClientId, setMlInputClientId] = useState("");
  const [mlInputClientSecret, setMlInputClientSecret] = useState("");

  // Shopee connection states
  const [showShopeeOAuth, setShowShopeeOAuth] = useState(false);
  const [shopeeAccountName, setShopeeAccountName] = useState("Desconectado");
  const [shopeeTempAccountName, setShopeeTempAccountName] = useState("Desconectado");
  const [isConnectingShopee, setIsConnectingShopee] = useState(false);
  const [isImportingShopee, setIsImportingShopee] = useState(false);
  const [shopeeInputPartnerId, setShopeeInputPartnerId] = useState("");
  const [shopeeInputPartnerKey, setShopeeInputPartnerKey] = useState("");

  // Product Search & Registration States
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdShopeeItemId, setNewProdShopeeItemId] = useState("");
  const [newProdMlItemId, setNewProdMlItemId] = useState("");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Shopee & TikTok Shop states
  const [publishToShopee, setPublishToShopee] = useState(false);
  const [shopeeCategoryId, setShopeeCategoryId] = useState("101140"); // Default Jewelry/Necklaces in Shopee
  const [shopeeBrandId, setShopeeBrandId] = useState("0"); // 0 = No Brand
  const [shopeeIsPreOrder, setShopeeIsPreOrder] = useState(false);
  const [shopeeDaysToShip, setShopeeDaysToShip] = useState("7");
  const [shopeeLogistics, setShopeeLogistics] = useState<string[]>(["correios"]);
  const [publishToTiktok, setPublishToTiktok] = useState(false);
  const [tiktokCategoryId, setTiktokCategoryId] = useState("600890"); // Default Necklaces in TikTok
  const [tiktokBrandId, setTiktokBrandId] = useState("0"); // 0 = No Brand



  // New Meli publishing states
  const [publishToMeli, setPublishToMeli] = useState(true);
  const [meliCategoryId, setMeliCategoryId] = useState("MLB1434");

  // Mercado Livre required fields (API POST /items)
  const [newProdCondition, setNewProdCondition] = useState<"new" | "used">("new");
  const [newProdListingType, setNewProdListingType] = useState("gold_special");
  const [newProdGtin, setNewProdGtin] = useState("");
  const [newProdBrand, setNewProdBrand] = useState("Fashion Shine");
  const [newProdMaterial, setNewProdMaterial] = useState("Prata 925");
  const [newProdColor, setNewProdColor] = useState("");
  const [newProdGender, setNewProdGender] = useState("Feminino");
  const [newProdWithGemstone, setNewProdWithGemstone] = useState(false);
  const [newProdSizes, setNewProdSizes] = useState("");
  const [newProdWeight, setNewProdWeight] = useState("");
  const [newProdLength, setNewProdLength] = useState("");
  const [newProdWidth, setNewProdWidth] = useState("");
  const [newProdHeight, setNewProdHeight] = useState("");

  // Mercado Livre Inspired Shipping Dashboard States
  const [shippingTab, setShippingTab] = useState<"today" | "next_days" | "in_transit" | "completed">("today");
  const [dashOrderSearch, setDashOrderSearch] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Persistent deleted items tracking across serverless sessions
  const [deletedSkus, setDeletedSkus] = useState<string[]>([]);

  // Persistent checked/reviewed products tracking
  const [checkedProductIds, setCheckedProductIds] = useState<string[]>([]);



  useEffect(() => {
    try {
      const saved = localStorage.getItem("fashion_shine_deleted_skus");
      if (saved) {
        setDeletedSkus(JSON.parse(saved));
      }
      const savedChecked = localStorage.getItem("fashion_shine_checked_products");
      if (savedChecked) {
        setCheckedProductIds(JSON.parse(savedChecked));
      }
    } catch (e) {
      console.error("Failed to load data from localStorage:", e);
    }
  }, []);

  const handleToggleCheckProduct = async (productId: string) => {
    // Optimistic UI update
    setCheckedProductIds(prev => {
      const isChecked = prev.includes(productId);
      return isChecked ? prev.filter(id => id !== productId) : [...prev, productId];
    });

    setProducts(prev => prev.map(p => {
      if (p.id === productId || p.sku === productId) {
        return { ...p, isChecked: !p.isChecked };
      }
      return p;
    }));

    try {
      await fetch("/api/products/toggle-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });
    } catch (err) {
      console.error("Failed to sync product check toggle to DB:", err);
    }
  };

  const handleNameChange = (name: string) => {
    setNewProdName(name);

    const lowerName = name.toLowerCase();
    
    // Keywords for Necklaces
    const isColar = ["colar", "colares", "pingente", "pingentes", "gargantilha", "gargantilhas", "choker", "chokers", "gravatinha", "escapulário", "escapularios"].some(word => lowerName.includes(word));
    
    // Keywords for Earrings
    const isBrinco = ["brinco", "brincos", "argola", "argolas", "piercing", "piercings", "ear cuff", "earcuff", "trio"].some(word => lowerName.includes(word));
    
    // Keywords for Bracelets
    const isPulseira = ["pulseira", "pulseiras", "bracelete", "braceletes", "tornozeleira", "tornozeleiras"].some(word => lowerName.includes(word));

    // Keywords for Rings
    const isAnel = ["anel", "anéis", "aneis", "aliança", "aliancas", "solitário", "solitarios"].some(word => lowerName.includes(word));

    if (isColar) {
      setMeliCategoryId("MLB1434");
    } else if (isBrinco) {
      setMeliCategoryId("MLB1432");
    } else if (isPulseira) {
      setMeliCategoryId("MLB1471");
    } else if (isAnel) {
      setMeliCategoryId("MLB1436");
    }
  };

  const handleGenerateSkuAndGtin = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const generatedSku = `FS-${randomCode}`;
    setNewProdSku(generatedSku);
    const generatedGtin = `789${Math.floor(100000000 + Math.random() * 900000000)}`;
    setNewProdGtin(generatedGtin);
  };

  const handleSkuChange = (sku: string) => {
    setNewProdSku(sku);
    // Automatically copy the numeric part of the SKU to the EAN/GTIN field
    const numericOnly = sku.replace(/\D/g, "");
    setNewProdGtin(numericOnly);
  };

  const getFriendlyErrorMessage = (rawError: string): string => {
    if (!rawError) return "Erro ao cadastrar produto: Erro desconhecido.";
    
    const lower = rawError.toLowerCase();
    
    if (lower.includes("access_token.invalid") || lower.includes("invalid_token") || lower.includes("unauthorized") || lower.includes("status 401")) {
      return `Erro ao cadastrar produto: Falha ao publicar no Mercado Livre: access_token.invalid

--------------------------------------------------
🔍 DIAGNÓSTICO DO ERRO:
A credencial de acesso temporária (access_token) do Mercado Livre expirou ou não está ativa no banco de dados.

💡 COMO RESOLVER:
1. Acesse a aba "CONFIGURAÇÕES DE INTEGRAÇÃO" no painel.
2. Clique no botão "Conectar" ao lado do Mercado Livre.
3. Isso vai te redirecionar para fazer o login no Mercado Livre e renovar as credenciais.
4. Se o problema persistir, certifique-se de que a variável DATABASE_URL está configurada corretamente na Vercel e que você fez o "Redeploy".`;
    }
    
    return `Erro ao cadastrar produto: ${rawError}`;
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target as HTMLElement;
    if (e.key === "Enter" && target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON") {
      e.preventDefault();
    }
  };

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
          shopeeStock: Number(newProdStock || 0),
          mlStock: Number(newProdStock || 0),
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
          // Shopee and TikTok fields
          publishToShopee,
          shopeeCategoryId,
          shopeeBrandId,
          shopeeIsPreOrder,
          shopeeDaysToShip,
          shopeeLogistics,
          publishToTiktok,
          tiktokCategoryId,
          tiktokBrandId
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
        
        if (data.product && data.product.mlItemId) {
          alert(`🎉 PRODUTO CADASTRADO E PUBLICADO NO MERCADO LIVRE COM SUCESSO!\n\nID do Anúncio: ${data.product.mlItemId}\nSKU: ${data.product.sku}\n\nO produto já está ativo e sincronizado com a conta da Fashion Shine!`);
        } else {
          alert("Produto cadastrado com sucesso no estoque central!");
        }
        
        // Reset form
        setNewProdName("");
        setNewProdSku("");
        setNewProdDesc("");
        setNewProdImageUrl("");
        setImagePreview("");
        setNewProdPrice("");
        setNewProdStock("");
        setNewProdShopeeItemId("");
        setNewProdMlItemId("");
        setPublishToMeli(true);
        setMeliCategoryId("MLB1434");
        // Reset ML fields to smart defaults
        setNewProdCondition("new");
        setNewProdListingType("gold_special");
        setNewProdGtin("");
        setNewProdBrand("Fashion Shine");
        setNewProdMaterial("Prata 925");
        setNewProdColor("");
        setNewProdGender("Feminino");
        setNewProdWithGemstone(false);
        setNewProdSizes("");
        setNewProdWeight("");
        setNewProdLength("");
        setNewProdWidth("");
        setNewProdHeight("");
        setShowAddProductModal(false);
        // Reset Shopee and TikTok fields
        setPublishToShopee(false);
        setShopeeCategoryId("101140");
        setShopeeBrandId("0");
        setShopeeIsPreOrder(false);
        setShopeeDaysToShip("7");
        setShopeeLogistics(["correios"]);
        setPublishToTiktok(false);
        setTiktokCategoryId("600890");
        setTiktokBrandId("0");
        setShowAddProductModal(false);
      } else {
        alert(getFriendlyErrorMessage(data.error));
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro de rede ao cadastrar produto.");
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Load real products from API if connected, respecting unified DB deletions
  const loadRealProducts = async () => {
    try {
      const res = await fetch("/api/sync/mercadolivre/products");
      if (res.ok) {
        const data = await res.json();
        if (data.connected && data.products && data.products.length > 0) {
          const dbRes = await fetch("/api/sync/products");
          if (dbRes.ok) {
            const dbData = await dbRes.json();
            if (dbData.products && dbData.products.length > 0) {
              setProducts(dbData.products);
              addLog(`Mercado Livre: Base sincronizada com ${dbData.products.length} anúncios ativos.`, "mercadolivre", "success");
              return;
            }
          }
          setProducts(data.products);
        }
      }
    } catch (err) {
      console.error("Error loading products:", err);
    }
  };

  // Load status and products database from API on mount
  useEffect(() => {
    async function checkStatusAndProducts() {
      // 1. Fetch unified stock levels first (source of truth)
      try {
        const res = await fetch("/api/sync/products", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.products && Array.isArray(data.products)) {
            setProducts(data.products);
            const checkedIds = data.products.filter((p: any) => p.isChecked).map((p: any) => p.id);
            setCheckedProductIds(checkedIds);
          }
        }
      } catch (err) {
        console.error("Error loading products from database:", err);
      }

      // 2. Fetch integration status
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
          if (data.mercadolivre.clientSecret) {
            setMlInputClientSecret(data.mercadolivre.clientSecret);
          }
          if (data.shopee.partnerId) {
            setShopeeInputPartnerId(data.shopee.partnerId);
          }
          
          if (data.mercadolivre.connected) {
            setMlAccountName(data.mercadolivre.nickname);
          }
        }
      } catch (err) {
        console.error("Error fetching integration status:", err);
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
    if (!mlInputClientId) {
      alert("Por favor, preencha o Client ID do Mercado Livre.");
      return;
    }
    if (!isMlConfigured && !mlInputClientSecret) {
      alert("Por favor, preencha o Client Secret do Mercado Livre.");
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
        addLog("Mercado Livre API: Credenciais salvas com sucesso.", "mercadolivre", "success");
        alert("Credenciais da API do Mercado Livre salvas com sucesso! Agora você já pode clicar em 'Conectar Conta'.");
      } else {
        const errData = await res.json();
        alert(`Erro ao salvar credenciais: ${errData.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erro de rede ao tentar salvar as credenciais.");
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
        alert(`Mercado Livre catalog imported successfully!\nImported: ${data.importedCount} new products\nUpdated: ${data.updatedCount} existing products`);
        
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
        alert(`Import Failed: ${errMsg}`);
      }
    } catch (err: any) {
      console.error("Catalog import error:", err);
      addLog(`Mercado Livre: Import failed due to server error.`, "mercadolivre", "error");
      alert(`Import Failed due to server error.`);
    } finally {
      setIsImportingMl(false);
    }
  };

  const handleSaveShopeeCredentials = async () => {
    if (!shopeeInputPartnerId) {
      alert("Por favor, preencha o Partner ID da Shopee.");
      return;
    }
    if (!isShopeeConfigured && !shopeeInputPartnerKey) {
      alert("Por favor, preencha o Partner Key da Shopee.");
      return;
    }
    try {
      const res = await fetch("/api/auth/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "shopee",
          partnerId: shopeeInputPartnerId,
          partnerKey: shopeeInputPartnerKey
        })
      });
      if (res.ok) {
        setIsShopeeConfigured(true);
        addLog("API Shopee: Credenciais salvas com segurança.", "shopee", "success");
        alert("Credenciais da API da Shopee salvas com sucesso!");
      } else {
        const errData = await res.json();
        alert(`Erro ao salvar credenciais: ${errData.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Erro de rede ao tentar salvar as credenciais.");
    }
  };

  const handleImportShopeeProducts = async () => {
    if (isImportingShopee) return;
    setIsImportingShopee(true);
    addLog("Shopee: Iniciando importação do catálogo...", "shopee", "success");

    try {
      const res = await fetch("/api/sync/shopee/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog(`Shopee: Catálogo importado! Importado: ${data.importedCount}, Atualizado: ${data.updatedCount} anúncios.`, "shopee", "success");
        alert(`Catálogo da Shopee importado com sucesso!\nImportados: ${data.importedCount} novos produtos\nAtualizados: ${data.updatedCount} produtos existentes`);
        
        // Refresh products list
        const prodRes = await fetch("/api/sync/products");
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.products) {
            setProducts(prodData.products);
          }
        }
      } else {
        const errMsg = data.error || "Falha ao importar catálogo";
        addLog(`Shopee: Importação falhou - ${errMsg}`, "shopee", "error");
        alert(`Falha na Importação: ${errMsg}`);
      }
    } catch (err: any) {
      console.error("Catalog import error:", err);
      addLog(`Shopee: Importação falhou devido a um erro no servidor.`, "shopee", "error");
      alert(`Falha na Importação devido a um erro no servidor.`);
    } finally {
      setIsImportingShopee(false);
    }
  };


  // Synced Products Data (starts empty)
  const [products, setProducts] = useState<ChannelProduct[]>([]);

  // Synced Orders Data (starts empty)
  const [orders, setOrders] = useState<ChannelOrder[]>([]);

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
    addLog("Iniciando sincronização manual dos canais...", "all", "success");

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
      addLog("API Shopee: Catálogo de anúncios sincronizado e pagamentos verificados.", "shopee", "success");
      addLog("API Mercado Livre: Sincronização de estoque local enviada aos canais.", "mercadolivre", "success");
      addLog("Sincronização do Sistema: Concluída com sucesso. Todo o estoque de inventário bate.", "all", "success");
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
              addLog(`Estoque Central: SKU ${p.sku} atualizado e sincronizado para ${val} unidades.`, channel, "success");
            } else {
              addLog(`Estoque Central: Falha ao sincronizar o estoque do SKU ${p.sku}.`, channel, "error");
            }
          });

          return {
            ...p,
            shopeeStock: val,
            mlStock: val,
            totalStock: val,
            lastSync: "Agora mesmo",
          };
        }
        return p;
      })
    );
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find(p => p.id === productId || p.sku === productId || p.mlItemId === productId);
    if (!product) return;

    const confirmed = window.confirm(`Tem certeza que deseja excluir permanentemente o produto "${product.name}"? Esta ação removerá o produto do servidor para todos os usuários.`);
    if (!confirmed) return;

    const targetId = product.id;

    // Optimistic UI update
    setProducts(prev => prev.filter(p => p.id !== targetId && p.sku !== product.sku));

    try {
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: targetId })
      });

      if (res.ok) {
        addLog(`Estoque Central: Produto SKU ${product.sku} ("${product.name}") excluído permanentemente do servidor.`, "all", "success");
        const syncRes = await fetch("/api/sync/products", { cache: "no-store" });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.products) {
            setProducts(syncData.products);
          }
        }
      } else {
        const errData = await res.json();
        const errorMsg = errData.error || "Erro desconhecido";
        addLog(`Estoque Central: Falha ao excluir o produto SKU ${product.sku} (${errorMsg}).`, "all", "error");
        alert(`Falha ao excluir o produto: ${errorMsg}`);
        const syncRes = await fetch("/api/sync/products", { cache: "no-store" });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.products) {
            setProducts(syncData.products);
          }
        }
      }
    } catch (err) {
      console.error("Delete product error:", err);
      addLog(`Estoque Central: Erro ao se conectar com o servidor para excluir o produto.`, "all", "error");
      alert(`Erro de rede ao tentar excluir o produto.`);
    }
  };

  // Simulated Label printing
  const handlePrintLabel = (orderId: string, channel: string) => {
    alert(`Etiqueta de Envio para o Pedido ${orderId} (${channel.toUpperCase()}) gerada com sucesso. Pronto para imprimir.`);
    addLog(`Etiqueta de envio impressa para o pedido ${orderId} (${channel.toUpperCase()}).`, channel as any, "success");
  };

  // Stats calculation
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const shopeeRevenue = orders.filter((o) => o.channel === "shopee").reduce((sum, o) => sum + o.total, 0);
  const mlRevenue = orders.filter((o) => o.channel === "mercadolivre").reduce((sum, o) => sum + o.total, 0);

  // Active products (excluding those deleted by the user)
  const activeProducts = products.filter((p) => {
    return !(
      deletedSkus.includes(p.id) ||
      deletedSkus.includes(p.sku) ||
      (p.mlItemId && deletedSkus.includes(p.mlItemId))
    );
  });

  const totalSyncCount = activeProducts.length;

  // Today's Stats
  const getTodayPrefix = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayPrefix = getTodayPrefix();
  const todayOrders = orders.filter(o => o.date.startsWith(todayPrefix));
  const todayOrdersCount = todayOrders.length;
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const shopeeTodayOrders = todayOrders.filter(o => o.channel === "shopee");
  const mlTodayOrders = todayOrders.filter(o => o.channel === "mercadolivre");
  const shopeeTodayRevenue = shopeeTodayOrders.reduce((sum, o) => sum + o.total, 0);
  const mlTodayRevenue = mlTodayOrders.reduce((sum, o) => sum + o.total, 0);

  // Monthly Stats
  const getMonthPrefix = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };
  const monthPrefix = getMonthPrefix();
  const monthOrders = orders.filter(o => o.date.startsWith(monthPrefix));
  const monthOrdersCount = monthOrders.length;
  const monthRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);
  const shopeeMonthRevenue = monthOrders.filter(o => o.channel === "shopee").reduce((sum, o) => sum + o.total, 0);
  const mlMonthRevenue = monthOrders.filter(o => o.channel === "mercadolivre").reduce((sum, o) => sum + o.total, 0);
  const shopeeMonthOrdersCount = monthOrders.filter(o => o.channel === "shopee").length;
  const mlMonthOrdersCount = monthOrders.filter(o => o.channel === "mercadolivre").length;

  // Active products & stock
  const activeStockUnits = activeProducts.reduce((sum, p) => sum + (p.totalStock || 0), 0);

  const filteredOrders = orders.filter((o) => {
    const matchesChannel = orderChannelFilter === "all" || o.channel === orderChannelFilter;
    const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
    return matchesChannel && matchesStatus;
  });

  const filteredTabOrders = orders.filter((o) => {
    // 1. Filter by Logistical Stage (shippingTab)
    let matchesTab = false;
    if (shippingTab === "today") {
      matchesTab = o.status === "ready_to_ship";
    } else if (shippingTab === "next_days") {
      matchesTab = o.status === "pending";
    } else if (shippingTab === "in_transit") {
      matchesTab = o.status === "shipped";
    } else if (shippingTab === "completed") {
      matchesTab = o.status === "delivered";
    }

    // 2. Filter by search input
    const query = dashOrderSearch.toLowerCase().trim();
    const matchesQuery = !query || 
      o.orderId.toLowerCase().includes(query) ||
      o.buyerName.toLowerCase().includes(query) ||
      o.items.some(item => item.name.toLowerCase().includes(query));

    return matchesTab && matchesQuery;
  });

  const filteredProducts = activeProducts.filter((p) => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.sku && p.sku.toLowerCase().includes(query))
    );
  });

  return (
    <div className="admin-layout">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap');
        
        h1, h2, h3, h4, h5, h6, .font-serif, .admin-header, .tab-button, .admin-tab-btn { 
          font-family: 'Cinzel Decorative', serif !important; 
        }
        
        body, p, span, button, input, select, label, td, th, div, a { 
          font-family: 'Inter', sans-serif !important; 
        }
      ` }} />
      {/* Top sticky nav bar */}
      <header className="admin-header">
        <div className="admin-container" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", padding: "0.8rem 2rem" }}>
          <img 
            src="/logo.png" 
            alt="Fashion Shine Semijoias" 
            style={{ height: "80px", width: "auto", objectFit: "contain" }}
          />
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
            Visão Geral
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
            onClick={() => setActiveTab("inventory")}
          >
            Estoque ({totalSyncCount})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Rastreamento de Pedidos ({orders.length})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Configurações de Integração
          </button>
        </div>

        {/* Tab 1: Dashboard Overview */}
        {activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Today's Live Stats Row */}
            <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stats-card" style={{ borderLeft: "4px solid var(--gold)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Pedidos de Hoje</span>
                <h3 className="font-serif" style={{ fontSize: "2.2rem", color: "var(--foreground)", margin: "0.5rem 0", fontWeight: "700" }}>
                  {todayOrdersCount} {todayOrdersCount === 1 ? "Pedido" : "Pedidos"}
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  <span>Shopee: <strong className="channel-shopee">{shopeeTodayOrders.length}</strong></span>
                  <span>M. Livre: <strong className="channel-ml">{mlTodayOrders.length}</strong></span>
                </div>
              </div>

              <div className="stats-card" style={{ borderLeft: "4px solid var(--gold)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Faturamento de Hoje</span>
                <h3 className="font-serif" style={{ fontSize: "2.2rem", color: "var(--gold)", margin: "0.5rem 0", fontWeight: "700" }}>
                  R$ {todayRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  <span>Shopee: <strong className="channel-shopee">R$ {shopeeTodayRevenue.toLocaleString("pt-BR")}</strong></span>
                  <span>M. Livre: <strong className="channel-ml">R$ {mlTodayRevenue.toLocaleString("pt-BR")}</strong></span>
                </div>
              </div>
            </div>

            {/* Shipping & Sales Dashboard inspired by Mercado Livre */}
            <div className="stats-card" style={{ marginBottom: "2rem", padding: "1.5rem" }}>
              {/* Tabs capsule list */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(45,43,39,0.08)", paddingBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { id: "today", label: "Envios de hoje", count: orders.filter(o => o.status === "ready_to_ship").length },
                    { id: "next_days", label: "Próximos dias", count: orders.filter(o => o.status === "pending").length },
                    { id: "in_transit", label: "Em trânsito", count: orders.filter(o => o.status === "shipped").length },
                    { id: "completed", label: "Finalizadas", count: orders.filter(o => o.status === "delivered").length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setShippingTab(tab.id as any);
                        setSelectedOrderIds([]);
                      }}
                      style={{
                        padding: "8px 16px",
                        fontSize: "0.85rem",
                        borderRadius: "30px",
                        background: shippingTab === tab.id ? "var(--foreground)" : "rgba(45, 43, 39, 0.05)",
                        color: shippingTab === tab.id ? "#ffffff" : "var(--foreground-muted)",
                        border: shippingTab === tab.id ? "1px solid var(--foreground)" : "1px solid rgba(45, 43, 39, 0.08)",
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      {tab.label}
                      <span style={{
                        fontSize: "0.75rem",
                        background: shippingTab === tab.id ? "var(--gold)" : "rgba(45,43,39,0.1)",
                        color: shippingTab === tab.id ? "#000000" : "var(--foreground)",
                        padding: "2px 6px",
                        borderRadius: "10px",
                        fontWeight: "bold"
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("orders")}
                  style={{
                    color: "var(--gold)",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  Gerenciar Pós-venda &gt;
                </button>
              </div>

              {/* Filters bar: Buscar, Últimos 2 meses, etc */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "1rem 0", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: "1 1 350px", maxWidth: "500px" }}>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      type="text"
                      placeholder="Buscar por comprador, item ou código do pedido..."
                      value={dashOrderSearch}
                      onChange={(e) => setDashOrderSearch(e.target.value)}
                      className="admin-input"
                      style={{ width: "100%", height: "38px", fontSize: "0.85rem", paddingLeft: "1rem" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    className="admin-input"
                    style={{ height: "38px", fontSize: "0.85rem", padding: "0 10px" }}
                    defaultValue="last_2_months"
                  >
                    <option value="last_2_months">Últimos 2 meses</option>
                    <option value="last_month">Último mês</option>
                    <option value="all">Todo o histórico</option>
                  </select>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setDashOrderSearch("");
                      setSelectedOrderIds([]);
                    }}
                    style={{ padding: "0 16px", height: "38px", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    Limpar Filtros
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", marginLeft: "10px" }}>
                    {filteredTabOrders.length} vendas
                  </span>
                </div>
              </div>

              {/* Mass Action bar */}
              <div style={{
                background: "rgba(45, 43, 39, 0.02)",
                border: "1px solid rgba(45, 43, 39, 0.08)",
                borderRadius: "6px",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="checkbox"
                    checked={filteredTabOrders.length > 0 && selectedOrderIds.length === filteredTabOrders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrderIds(filteredTabOrders.map(o => o.id));
                      } else {
                        setSelectedOrderIds([]);
                      }
                    }}
                    disabled={filteredTabOrders.length === 0}
                    style={{ width: "16px", height: "16px", accentColor: "var(--gold)" }}
                  />
                  <span style={{ fontSize: "0.85rem", fontWeight: selectedOrderIds.length > 0 ? "600" : "normal" }}>
                    {selectedOrderIds.length > 0 
                      ? `${selectedOrderIds.length} vendas selecionadas` 
                      : "Selecione vendas para acionar em massa"
                    }
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => alert(`NF-e emitida com sucesso para as ${selectedOrderIds.length} vendas selecionadas!`)}
                    style={{
                      background: selectedOrderIds.length > 0 ? "rgba(45,43,39,0.06)" : "transparent",
                      color: selectedOrderIds.length > 0 ? "var(--foreground)" : "var(--foreground-muted)",
                      border: "1px solid rgba(45,43,39,0.12)",
                      borderRadius: "4px",
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      cursor: selectedOrderIds.length > 0 ? "pointer" : "default"
                    }}
                  >
                    Informar a NF-e
                  </button>
                  <button
                    type="button"
                    disabled={selectedOrderIds.length === 0}
                    onClick={() => {
                      selectedOrderIds.forEach(id => {
                        const order = orders.find(o => o.id === id);
                        if (order) handlePrintLabel(order.orderId, order.channel);
                      });
                      setSelectedOrderIds([]);
                    }}
                    style={{
                      background: selectedOrderIds.length > 0 ? "var(--gold)" : "transparent",
                      color: selectedOrderIds.length > 0 ? "#000000" : "var(--foreground-muted)",
                      border: selectedOrderIds.length > 0 ? "1px solid var(--gold)" : "1px solid rgba(45,43,39,0.12)",
                      borderRadius: "4px",
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      fontWeight: selectedOrderIds.length > 0 ? "600" : "normal",
                      cursor: selectedOrderIds.length > 0 ? "pointer" : "default"
                    }}
                  >
                    Imprimir etiquetas
                  </button>
                </div>
              </div>

              {/* Orders List / Empty State */}
              {filteredTabOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                  {/* Empty state Magnifier Icon */}
                  <div style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: "rgba(45,43,39,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed rgba(179,151,90,0.3)"
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      <line x1="8" y1="8" x2="14" y2="14"></line>
                      <line x1="14" y1="8" x2="8" y2="14"></line>
                    </svg>
                  </div>
                  <div>
                    <h4 style={{ fontWeight: "600", fontSize: "1.1rem", color: "var(--foreground)" }}>
                      {dashOrderSearch ? "Nenhum resultado para a busca" : `Você não tem vendas com envios para: ${
                        shippingTab === "today" ? "Hoje" :
                        shippingTab === "next_days" ? "Próximos dias" :
                        shippingTab === "in_transit" ? "Em trânsito" : "Finalizadas"
                      }`}
                    </h4>
                    <p style={{ color: "var(--foreground-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                      {dashOrderSearch 
                        ? "Limpe os filtros para buscar outras opções de pedidos." 
                        : "Os pedidos integrados de Shopee e Mercado Livre aparecerão aqui divididos pelo estágio logístico correspondente."
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDashOrderSearch("");
                      setSelectedOrderIds([]);
                    }}
                    style={{
                      background: "rgba(179,151,90,0.12)",
                      border: "1px solid var(--gold)",
                      color: "var(--gold)",
                      padding: "8px 20px",
                      borderRadius: "30px",
                      fontSize: "0.85rem",
                      fontWeight: "600"
                    }}
                  >
                    Limpar Filtros
                  </button>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}></th>
                        <th>Pedido & Canal</th>
                        <th>Comprador</th>
                        <th>Itens Comprados</th>
                        <th>Total</th>
                        <th>Código de Rastreamento</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTabOrders.map((ord) => {
                        const isSelected = selectedOrderIds.includes(ord.id);
                        return (
                          <tr key={ord.id} style={{ background: isSelected ? "rgba(179,151,90,0.03)" : "transparent" }}>
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrderIds(prev => [...prev, ord.id]);
                                  } else {
                                    setSelectedOrderIds(prev => prev.filter(id => id !== ord.id));
                                  }
                                }}
                                style={{ width: "16px", height: "16px", accentColor: "var(--gold)", cursor: "pointer" }}
                              />
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: "600" }}>{ord.orderId}</span>
                                <span className={`badge ${ord.channel === "shopee" ? "bg-shopee" : "bg-ml"}`} style={{ width: "fit-content", marginTop: "4px" }}>
                                  {ord.channel === "shopee" ? "Shopee" : "Mercado Livre"}
                                </span>
                              </div>
                            </td>
                            <td>{ord.buyerName}</td>
                            <td>
                              {ord.items.map((item, i) => (
                                <div key={i} style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>
                                  {item.quantity}x {item.name}
                                </div>
                              ))}
                            </td>
                            <td style={{ fontWeight: "600", color: "var(--gold)" }}>R$ {ord.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{ord.trackingCode}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handlePrintLabel(ord.orderId, ord.channel)}
                                style={{
                                  background: "var(--gold)",
                                  color: "#000000",
                                  fontSize: "0.75rem",
                                  padding: "4px 10px",
                                  borderRadius: "4px",
                                  fontWeight: "600"
                                }}
                              >
                                Imprimir Etiqueta
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Overall System Stats (Consolidated indicators) */}
            <div className="stats-grid" style={{ marginBottom: "2.5rem" }}>
              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Faturamento Mensal</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", color: "var(--gold)", margin: "0.5rem 0", fontWeight: "600" }}>
                  R$ {monthRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  <span>Shopee: <strong className="channel-shopee">R$ {shopeeMonthRevenue.toLocaleString("pt-BR")}</strong></span>
                  <span>M. Livre: <strong className="channel-ml">R$ {mlMonthRevenue.toLocaleString("pt-BR")}</strong></span>
                </div>
              </div>

              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vendas no Mês</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", margin: "0.5rem 0", fontWeight: "600" }}>
                  {monthOrdersCount} {monthOrdersCount === 1 ? "Pedido" : "Pedidos"}
                </h3>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  <span>Shopee: <strong className="channel-shopee">{shopeeMonthOrdersCount}</strong></span>
                  <span>M. Livre: <strong className="channel-ml">{mlMonthOrdersCount}</strong></span>
                </div>
              </div>

              <div className="stats-card">
                <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Produtos Ativos</span>
                <h3 className="font-serif" style={{ fontSize: "2rem", margin: "0.5rem 0", fontWeight: "600" }}>
                  {totalSyncCount} SKU's Ativos
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--foreground-muted)" }}>
                  <span className="pulse-green" />
                  <span>{activeStockUnits} unidades físicas em estoque</span>
                </div>
              </div>
            </div>

            {/* Bottom Row (Marketplace Sales Performance Indicator) */}
            <div style={{ marginBottom: "2rem" }}>
              <div className="stats-card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {/* Shopee Bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                      <span className="channel-shopee" style={{ fontWeight: "600" }}>Shopee</span>
                      <span>{Math.round((shopeeRevenue / (totalRevenue || 1)) * 100)}% ({orders.filter(o => o.channel === "shopee").length} Vendas)</span>
                    </div>
                    <div style={{ background: "rgba(45, 43, 39, 0.06)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#cbbca0", height: "100%", width: `${(shopeeRevenue / (totalRevenue || 1)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Mercado Livre Bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                      <span className="channel-ml" style={{ fontWeight: "600" }}>Mercado Livre</span>
                      <span>{Math.round((mlRevenue / (totalRevenue || 1)) * 100)}% ({orders.filter(o => o.channel === "mercadolivre").length} Vendas)</span>
                    </div>
                    <div style={{ background: "rgba(45, 43, 39, 0.06)", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "var(--gold)", height: "100%", width: `${(mlRevenue / (totalRevenue || 1)) * 100}%` }} />
                    </div>
                  </div>
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
                    <th style={{ width: "65px", textAlign: "center" }}>Foto</th>
                    <th>Nome do Produto & SKU</th>
                    <th>Estoque</th>
                    <th>Status</th>
                    <th>Preço Base</th>
                    <th>Última Sincronização</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => (
                    <tr key={prod.id}>
                      <td style={{ textAlign: "center" }}>
                        {prod.imageUrl ? (
                          <img 
                            src={prod.imageUrl} 
                            alt={prod.name} 
                            style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.12)" }} 
                          />
                        ) : (
                          <div style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px dashed rgba(255, 255, 255, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--gold)",
                          }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
                              <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
                              <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
                            </svg>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "700", color: "#1a1a1a", fontSize: "0.92rem" }}>{prod.name}</span>
                          <span style={{ fontSize: "0.75rem", color: "#555555", fontFamily: "monospace", marginTop: "2px", fontWeight: "600" }}>SKU: {prod.sku}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ fontWeight: "800", fontSize: "0.95rem", color: "#8c7138" }}>
                            {prod.totalStock} {prod.totalStock === 1 ? "unidade" : "unidades"}
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "#444444" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              ML: 
                              <input
                                type="number"
                                min="0"
                                value={prod.mlStock}
                                onChange={(e) => handleUpdateStock(prod.id, "mercadolivre", parseInt(e.target.value))}
                                style={{ width: "55px", padding: "2px 6px", fontSize: "0.75rem", color: "#1a1a1a", fontWeight: "600" }}
                                className="admin-input"
                              />
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              Shopee: 
                              <input
                                type="number"
                                min="0"
                                value={prod.shopeeStock}
                                onChange={(e) => handleUpdateStock(prod.id, "shopee", parseInt(e.target.value))}
                                style={{ width: "55px", padding: "2px 6px", fontSize: "0.75rem", color: "#1a1a1a", fontWeight: "600" }}
                                className="admin-input"
                              />
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#047857", fontSize: "0.75rem", width: "fit-content", fontWeight: "700" }}>
                            Sincronizado ML
                          </span>
                          {prod.shopeeSynced && (
                            <span className="badge" style={{ background: "rgba(238, 77, 45, 0.15)", color: "#c23616", fontSize: "0.75rem", width: "fit-content", fontWeight: "700" }}>
                              Sincronizado Shopee
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: "700", color: "#1a1a1a" }}>R$ {prod.basePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontSize: "0.85rem", color: "#555555", fontWeight: "500" }}>{prod.lastSync === "Just now" ? "Agora mesmo" : prod.lastSync}</td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {/* Check button */}
                          <button
                            onClick={() => handleToggleCheckProduct(prod.id)}
                            style={{
                              background: checkedProductIds.includes(prod.id) ? "rgba(16, 185, 129, 0.15)" : "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: checkedProductIds.includes(prod.id) ? "#047857" : "#9ca3af",
                              padding: "6px",
                              borderRadius: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "background 0.2s, color 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              if (!checkedProductIds.includes(prod.id)) {
                                e.currentTarget.style.background = "rgba(16, 185, 129, 0.1)";
                                e.currentTarget.style.color = "#047857";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!checkedProductIds.includes(prod.id)) {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "#9ca3af";
                              }
                            }}
                            title={checkedProductIds.includes(prod.id) ? "Remover conferência" : "Marcar como conferido"}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="btn-delete"
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#ef4444",
                              padding: "6px",
                              borderRadius: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "background 0.2s"
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            title="Excluir produto"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
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
              background: "#ffffff",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid rgba(45, 43, 39, 0.08)"
            }}>
              <div style={{ display: "flex", gap: "10px" }}>
                {/* Channel filters */}
                <button
                  onClick={() => setOrderChannelFilter("all")}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: orderChannelFilter === "all" ? "var(--gold)" : "rgba(45,43,39,0.05)",
                    color: orderChannelFilter === "all" ? "#ffffff" : "#444444",
                    fontWeight: orderChannelFilter === "all" ? "600" : "normal"
                  }}
                >
                  Todos os Canais
                </button>
                <button
                  onClick={() => setOrderChannelFilter("shopee")}
                  style={{
                    fontSize: "0.8rem",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    background: orderChannelFilter === "shopee" ? "#ee4d2d" : "rgba(45,43,39,0.05)",
                    color: "#ffffff",
                    fontWeight: orderChannelFilter === "shopee" ? "600" : "normal"
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
                    background: orderChannelFilter === "mercadolivre" ? "#b3975a" : "rgba(45,43,39,0.05)",
                    color: "#ffffff",
                    fontWeight: orderChannelFilter === "mercadolivre" ? "600" : "normal"
                  }}
                >
                  Mercado Livre
                </button>
              </div>

              {/* Status Select filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", color: "#444444", fontWeight: "600" }}>Status do Pedido:</span>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="admin-input"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#1a1a1a", background: "#ffffff" }}
                >
                  <option value="all">Ver Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="ready_to_ship">Pronto para Envio</option>
                  <option value="shipped">Enviado</option>
                  <option value="delivered">Entregue</option>
                </select>
              </div>
            </div>

            {/* Orders Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pedido & ID de Rastreamento</th>
                    <th>Canal</th>
                    <th>Comprador</th>
                    <th>Itens Comprados</th>
                    <th>Total do Pedido</th>
                    <th>Status do Pedido</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#666666", padding: "3rem" }}>
                        Nenhum pedido corresponde aos filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "700", color: "#1a1a1a" }}>{ord.orderId}</span>
                            <span style={{ fontSize: "0.75rem", color: "#555555", fontFamily: "monospace" }}>
                              Rastreamento: {ord.trackingCode}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ord.channel === "shopee" ? "bg-shopee" : "bg-ml"}`}>
                            {ord.channel === "shopee" ? "Shopee" : "Mercado Livre"}
                          </span>
                        </td>
                        <td style={{ color: "#1a1a1a", fontWeight: "500" }}>{ord.buyerName}</td>
                        <td>
                          {ord.items.map((item, i) => (
                            <span key={i} style={{ fontSize: "0.85rem", color: "#1a1a1a", fontWeight: "500" }}>
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </td>
                        <td style={{ color: "#8c7138", fontWeight: "700" }}>R$ {ord.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
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
                            {ord.status === "pending" ? "Pendente" :
                             ord.status === "ready_to_ship" ? "Pronto para Envio" :
                             ord.status === "shipped" ? "Enviado" : "Entregue"}
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
                              Imprimir Etiqueta
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Etiqueta Gerada</span>
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
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Header row with Title and Sincronizar Canais button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255, 255, 255, 0.03)", padding: "1rem 1.5rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <h3 className="font-serif" style={{ fontSize: "1.3rem", color: "var(--gold)", margin: 0 }}>Gerenciamento de Integrações</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted)", margin: "4px 0 0 0" }}>Configure suas credenciais de API oficiais e sincronize as conexões ativas.</p>
              </div>
              <button 
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="btn-gold"
                style={{
                  padding: "0.6rem 1.5rem",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                <svg 
                  className={isSyncing ? "spin-sync" : ""} 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                {isSyncing ? "Sincronizando..." : "Sincronizar Canais"}
              </button>
            </div>

            {/* Integration Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
              
              {/* Shopee Integration Card */}
              <div className={`connection-card ${config.shopeeConnected ? "active" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="badge bg-shopee">Shopee</span>
                    <h4 className="font-serif" style={{ fontSize: "1.2rem", margin: 0 }}>Configuração da API da Shopee</h4>
                  </div>
                  <button
                    onClick={() => {
                      if (config.shopeeConnected) {
                        // Disconnect Shopee
                        fetch("/api/auth/status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ channel: "shopee", disconnect: true })
                        }).then(() => {
                          setConfig(prev => ({ ...prev, shopeeConnected: false }));
                          addLog("Desconectou a integração com o canal da API Shopee.", "shopee", "warning");
                        });
                      } else {
                        if (isShopeeConfigured) {
                          window.location.href = "/api/auth/shopee";
                        } else {
                          setShowShopeeCredsWarning(true);
                        }
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "4px",
                      background: config.shopeeConnected ? "rgba(255, 77, 77, 0.15)" : "var(--gold)",
                      color: config.shopeeConnected ? "#ff4d4d" : "#000000",
                      fontSize: "0.8rem",
                      fontWeight: "500",
                      border: "none",
                      cursor: "pointer"
                    }}
                  >
                    {config.shopeeConnected ? "Desconectar" : "Conectar Conta"}
                  </button>
                </div>

                {config.shopeeConnected ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{
                      background: "rgba(238, 77, 45, 0.05)",
                      border: "1px solid rgba(238, 77, 45, 0.15)",
                      padding: "1rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem"
                    }}>
                      <span style={{ color: "var(--foreground-muted)" }}>Loja Conectada: </span>
                      <strong style={{ color: "#ee4d2d" }}>{shopeeAccountName}</strong>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Token de Acesso (OAuth 2.0)</label>
                      <input
                        type="password"
                        value={config.shopeeApiKey}
                        onChange={(e) => setConfig(prev => ({ ...prev, shopeeApiKey: e.target.value }))}
                        className="admin-input"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Mapeamento do ID da Loja</label>
                      <input
                        type="text"
                        defaultValue="shp_shop_5510293"
                        className="admin-input"
                      />
                    </div>
                    <button
                      onClick={handleImportShopeeProducts}
                      disabled={isImportingShopee}
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
                      {isImportingShopee ? "Importando Catálogo..." : "Importar Catálogo da Shopee"}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>ID do Parceiro (Partner ID)</label>
                      <input
                        type="text"
                        placeholder="Ex: 1002938"
                        value={shopeeInputPartnerId}
                        onChange={(e) => setShopeeInputPartnerId(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Chave de Assinatura (Partner Key)</label>
                      <input
                        type="password"
                        placeholder="Sua chave de parceiro da Shopee"
                        value={shopeeInputPartnerKey}
                        onChange={(e) => setShopeeInputPartnerKey(e.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <button
                      onClick={handleSaveShopeeCredentials}
                      className="btn-outline"
                      style={{ padding: "0.5rem 0", fontSize: "0.8rem", width: "100%" }}
                    >
                      Salvar Credenciais da API
                    </button>
                    <div style={{ color: "var(--foreground-muted)", fontSize: "0.8rem", fontStyle: "italic", marginTop: "4px" }}>
                      {isShopeeConfigured 
                        ? "✓ Credenciais configuradas. Clique em Conectar Conta para autorizar."
                        : "ⓘ Credenciais não configuradas. Preencha os campos para integração real, ou clique em Conectar Conta para acessar o Simulador."}
                    </div>
                  </div>
                )}
              </div>

            {/* Mercado Livre Integration Card */}
            <div className={`connection-card ${config.mlConnected ? "active" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge bg-ml">Mercado Livre</span>
                  <h4 className="font-serif" style={{ fontSize: "1.2rem" }}>Configuração da API do Mercado Livre</h4>
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
                  {config.mlConnected ? "Desconectar" : "Conectar Conta"}
                </button>
              </div>

              {config.mlConnected && (
                <div style={{
                  background: "rgba(255, 230, 0, 0.05)",
                  border: "1px solid rgba(255, 230, 0, 0.15)",
                  padding: "1rem",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  marginBottom: "1rem"
                }}>
                  <span style={{ color: "var(--foreground-muted)" }}>Conta Conectada: </span>
                  <strong style={{ color: "#ffe600" }}>{mlAccountName}</strong>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>ID do Aplicativo (Client ID)</label>
                  <input
                    type="text"
                    placeholder="Ex: 6534119322003352"
                    value={mlInputClientId}
                    onChange={(e) => setMlInputClientId(e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Chave Secreta (Client Secret)</label>
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
                  style={{ padding: "0.5rem 0", fontSize: "0.8rem", width: "100%", border: "1px solid var(--gold)", color: "var(--gold)", background: "transparent", borderRadius: "4px", cursor: "pointer" }}
                >
                  Salvar Credenciais da API
                </button>
                <div style={{ color: "var(--foreground-muted)", fontSize: "0.8rem", fontStyle: "italic", marginTop: "4px" }}>
                  {isMlConfigured 
                    ? "✓ Credenciais configuradas e salvas."
                    : "ⓘ Credenciais não configuradas. Preencha os campos e salve."}
                </div>

                {config.mlConnected && (
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
                )}
              </div>
            </div>
          </div>

          {/* General sync parameters */}
            <div className="connection-card">
              <h4 className="font-serif" style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Parâmetros de Sincronização Automatizada</h4>
              
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
                    Ativar sincronização automática em segundo plano
                  </label>
                </div>

                {/* Interval Slider */}
                {config.autoSync && (
                  <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1, minWidth: "250px" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", whiteSpace: "nowrap" }}>
                      Frequência de Sincronização: <strong>{config.syncInterval} minutos</strong>
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

            {/* API Logs console card (relocated from dashboard overview) */}
            <div className="stats-card" style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 className="font-serif" style={{ fontSize: "1.2rem", margin: 0 }}>Logs de Integração da API</h4>
                <button 
                  type="button"
                  onClick={() => setSyncLogs([])}
                  style={{ fontSize: "0.75rem", color: "var(--foreground-muted)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Limpar Console
                </button>
              </div>
              <div className="console-log" style={{ minHeight: "150px" }}>
                {syncLogs.length === 0 ? (
                  <span style={{ color: "#a1a1aa" }}>Console pronto. Execute a sincronização para gerar logs.</span>
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
                        // Persist mock connection in the backend
                        fetch("/api/auth/status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            channel: "mercadolivre",
                            simulate: true,
                            nickname: mlTempAccountName || "Fashion Shine Oficial"
                          })
                        }).then(res => {
                          if (res.ok) {
                            setMlAccountName(mlTempAccountName || "Fashion Shine Oficial");
                            setConfig(prev => ({ ...prev, mlConnected: true, mlApiKey: `mla_oauth_tok_fashion_shine_live_${Date.now()}` }));
                            addLog(`Mercado Livre API: Account '${mlTempAccountName || "Fashion Shine Oficial"}' connected via OAuth 2.0.`, "mercadolivre", "success");
                          } else {
                            alert("Falha ao salvar a conexão simulada.");
                          }
                          setIsConnectingMl(false);
                          setShowMlOAuth(false);
                        }).catch(err => {
                          console.error(err);
                          setIsConnectingMl(false);
                          setShowMlOAuth(false);
                        });
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
            background: "#EFEBE0",
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
            <form onSubmit={handleCreateProduct} onKeyDown={handleFormKeyDown} style={{ overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Photo Upload Container */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--foreground)" }}>Foto do Produto</label>
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
                    background: "rgba(255, 255, 255, 0.6)",
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
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--foreground-muted)", gap: "6px" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1.8rem" }}>photo_camera</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Arraste uma imagem ou insira a URL</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SEÇÃO 1: INFORMAÇÕES BÁSICAS ── */}
              <div style={{
                background: "rgba(255, 255, 255, 0.4)",
                border: "1px solid rgba(45, 43, 39, 0.08)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>📋 Informações Básicas</span>

                {/* Nome do Produto */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Título do Anúncio <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Máx. 60 caracteres. Seja claro e use palavras-chave.</span>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={newProdName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Colar Brilhante Ouro 18k Feminino"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                  <span style={{ fontSize: "0.68rem", color: newProdName.length > 50 ? "#f59e0b" : "var(--foreground-muted)", textAlign: "right" }}>{newProdName.length}/60</span>
                </div>

                {/* Código de Barras (EAN / GTIN) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>Código EAN / GTIN (Código de Barras)</label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>13 dígitos. Obrigatório em muitas categorias.</span>
                  <input
                    type="text"
                    maxLength={14}
                    value={newProdGtin}
                    onChange={(e) => setNewProdGtin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 7891234567890"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", fontFamily: "monospace" }}
                  />
                </div>

                {/* SKU e EAN com Gerador Automático */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                      SKU Interno & EAN (Código de Barras) <span style={{ color: "#ff4d4d" }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSkuAndGtin}
                      style={{
                        padding: "0.25rem 0.6rem",
                        background: "rgba(212, 175, 55, 0.15)",
                        color: "var(--gold)",
                        border: "1px solid var(--gold)",
                        borderRadius: "4px",
                        fontSize: "0.68rem",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      ⚡ Gerar SKU e EAN Automático
                    </button>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Seu código único de controle (seller_custom_field no ML) e código GTIN/EAN de 13 dígitos.</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <input
                      type="text"
                      required
                      value={newProdSku}
                      onChange={(e) => handleSkuChange(e.target.value)}
                      placeholder="SKU ex: FS-1023"
                      className="admin-input"
                      style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                    />
                    <input
                      type="text"
                      maxLength={14}
                      value={newProdGtin}
                      onChange={(e) => setNewProdGtin(e.target.value.replace(/\D/g, ""))}
                      placeholder="EAN ex: 7891234567890"
                      className="admin-input"
                      style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", fontFamily: "monospace" }}
                    />
                  </div>
                </div>

                {/* Condição */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
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
                          border: newProdCondition === c ? "1px solid var(--gold)" : "1px solid rgba(45, 43, 39, 0.12)",
                          background: newProdCondition === c ? "rgba(212,175,55,0.15)" : "#ffffff",
                          color: newProdCondition === c ? "var(--gold)" : "var(--foreground-muted)",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {c === "new" ? "Novo" : "Usado"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descrição */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>Descrição Completa</label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Enviada como plain_text para a API do ML.</span>
                  <textarea
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    placeholder="Descreva o material, dimensões, diferenciais..."
                    rows={3}
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", resize: "vertical" }}
                  />
                </div>
              </div>

              {/* ── SEÇÃO 2: CLASSIFICAÇÃO NO MERCADO LIVRE ── */}
              <div style={{
                background: "rgba(212, 175, 55, 0.05)",
                border: "1px solid rgba(212, 175, 55, 0.15)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em" }}>🛒 Classificação Mercado Livre</span>

                {/* Categoria MLB */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Categoria Mercado Livre (category_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Reconhecida automaticamente pelo nome do produto ou selecione abaixo:</span>
                  <select
                    value={meliCategoryId}
                    onChange={(e) => setMeliCategoryId(e.target.value)}
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(212, 175, 55, 0.25)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="MLB1434">Colares e Pingentes (MLB1434)</option>
                    <option value="MLB1432">Brincos e Argolas (MLB1432)</option>
                    <option value="MLB1471">Pulseiras e Braceletes (MLB1471)</option>
                    <option value="MLB1436">Anéis e Alianças (MLB1436)</option>
                  </select>
                </div>

                {/* Tipo de Anúncio */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Tipo de Anúncio (listing_type_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Define visibilidade e tarifa cobrada pelo ML.</span>
                  <select
                    value={newProdListingType}
                    onChange={(e) => setNewProdListingType(e.target.value)}
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(212, 175, 55, 0.25)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  >
                    <option value="gold_pro">🥇 Gold Pro — Máxima exposição (16% tarifa)</option>
                    <option value="gold_special">⭐ Gold Special — Alta exposição (12% tarifa)</option>
                    <option value="gold">🥈 Gold — Boa exposição (9% tarifa)</option>
                    <option value="silver">🥉 Silver — Exposição padrão (6% tarifa)</option>
                    <option value="free">🆓 Grátis — Sem tarifa, sem destaque</option>
                  </select>
                </div>

                {/* Publicar no ML */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem 0.75rem", background: "rgba(212, 175, 55, 0.08)", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="publish-to-meli-checkbox"
                    checked={publishToMeli}
                    onChange={(e) => setPublishToMeli(e.target.checked)}
                    style={{ accentColor: "var(--gold)", cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="publish-to-meli-checkbox" style={{ fontSize: "0.8rem", color: "var(--foreground)", cursor: "pointer", fontWeight: "600" }}>
                    Publicar anúncio no Mercado Livre imediatamente após salvar
                  </label>
                </div>
              </div>

              {/* ── SEÇÃO 3: PREÇO E ESTOQUE ── */}
              <div style={{
                background: "rgba(255, 255, 255, 0.4)",
                border: "1px solid rgba(45, 43, 39, 0.08)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", fontWeight: "700", color: "var(--foreground-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Preço e Estoque</span>

                {/* Preço Base */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Preço de Venda (R$) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Enviado como `price` na API. Moeda fixada em BRL.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Estoque */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>Estoque Inicial <span style={{ color: "#ff4d4d" }}>*</span></label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Sincronizado automaticamente entre Mercado Livre, Shopee e TikTok Shop.</span>
                  <input
                    type="number"
                    min="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    placeholder="0"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(45, 43, 39, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>
              </div>

              {/* ── SEÇÃO 4: ATRIBUTOS DO PRODUTO ── */}
              <div style={{
                background: "rgba(99, 102, 241, 0.04)",
                border: "1px solid rgba(99, 102, 241, 0.12)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", fontWeight: "700", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.1em" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg> Atributos do Produto</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontStyle: "italic" }}>Enviados como `attributes[]` na API</span>
                </div>

                {/* Marca */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Marca (BRAND) {publishToMeli && <span style={{ color: "#ff4d4d" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    required={publishToMeli}
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    placeholder="Ex: Fashion Shine"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(99,102,241,0.25)", color: "var(--foreground)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Material com Chips Rápidos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Material Principal (MATERIAL) {publishToMeli && <span style={{ color: "#ff4d4d" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    required={publishToMeli}
                    value={newProdMaterial}
                    onChange={(e) => setNewProdMaterial(e.target.value)}
                    placeholder="Ex: Prata 925, Estanho, Aço Inoxidável"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(99,102,241,0.25)", color: "var(--foreground)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                    {["Prata 925", "Estanho", "Aço Inoxidável", "Banhado a Ouro 18k", "Ródio Negro"].map((mat) => (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => setNewProdMaterial(mat)}
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          border: newProdMaterial === mat ? "1px solid #6366f1" : "1px solid rgba(99,102,241,0.2)",
                          background: newProdMaterial === mat ? "rgba(99,102,241,0.15)" : "#ffffff",
                          color: newProdMaterial === mat ? "#6366f1" : "var(--foreground-muted)",
                          cursor: "pointer"
                        }}
                      >
                        {mat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor com Chips Rápidos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>Cor Principal (COLOR)</label>
                  <input
                    type="text"
                    value={newProdColor}
                    onChange={(e) => setNewProdColor(e.target.value)}
                    placeholder="Ex: Dourado, Prata, Ródio Negro"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(99,102,241,0.25)", color: "var(--foreground)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                    {["Dourado", "Prata", "Ródio Negro", "Rose Gold", "Preto", "Azul"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewProdColor(c)}
                        style={{
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          border: newProdColor === c ? "1px solid #6366f1" : "1px solid rgba(99,102,241,0.2)",
                          background: newProdColor === c ? "rgba(99,102,241,0.15)" : "#ffffff",
                          color: newProdColor === c ? "#6366f1" : "var(--foreground-muted)",
                          cursor: "pointer"
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Com Pedra (WITH_GEMSTONE) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>Possui Pedra / Zircônia (WITH_GEMSTONE)</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[true, false].map((v) => (
                      <button
                        key={v ? "sim" : "nao"}
                        type="button"
                        onClick={() => setNewProdWithGemstone(v)}
                        style={{
                          flex: 1,
                          padding: "0.45rem 0.3rem",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: "500",
                          border: newProdWithGemstone === v ? "1px solid #6366f1" : "1px solid rgba(45, 43, 39, 0.12)",
                          background: newProdWithGemstone === v ? "rgba(99,102,241,0.15)" : "#ffffff",
                          color: newProdWithGemstone === v ? "#6366f1" : "var(--foreground-muted)",
                          cursor: "pointer"
                        }}
                      >
                        {v ? "Sim (Com pedra/zircônia)" : "Não (Sem pedra)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gênero */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>
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
                          border: newProdGender === g ? "1px solid #6366f1" : "1px solid rgba(45, 43, 39, 0.12)",
                          background: newProdGender === g ? "rgba(99,102,241,0.15)" : "#ffffff",
                          color: newProdGender === g ? "#6366f1" : "var(--foreground-muted)",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                      >
                        {g === "" ? "—" : g === "Feminino" ? "Feminino" : g === "Masculino" ? "Masculino" : "Unissex"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tamanhos */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>Tamanhos Disponíveis (SIZE)</label>
                  <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>Separados por vírgula. Ex: PP, P, M, G, GG · ou: 36, 38, 40</span>
                  <input
                    type="text"
                    value={newProdSizes}
                    onChange={(e) => setNewProdSizes(e.target.value)}
                    placeholder="Ex: P, M, G, GG"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(99,102,241,0.25)", color: "var(--foreground)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>

              {/* ── SEÇÃO 5: LOGÍSTICA E FRETE ── */}
              <div style={{
                background: "rgba(16, 185, 129, 0.04)",
                border: "1px solid rgba(16, 185, 129, 0.12)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", fontWeight: "700", color: "#059669", textTransform: "uppercase", letterSpacing: "0.1em" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 16 12 21 3 16"></polyline><polyline points="21 8 12 13 3 8"></polyline><polyline points="12 21 12 13"></polyline><line x1="12" y1="3" x2="12" y2="13"></line><polygon points="12 3 21 8 12 13 3 8"></polygon></svg> Logística & Frete</span>
                  <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)", fontStyle: "italic" }}>Afeta cálculo de frete pelo ML</span>
                </div>

                {/* Peso */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>Peso do Produto (gramas)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProdWeight}
                    onChange={(e) => setNewProdWeight(e.target.value)}
                    placeholder="Ex: 150 (em gramas)"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(16,185,129,0.25)", color: "var(--foreground)", padding: "0.6rem 0.75rem", borderRadius: "8px", fontSize: "0.82rem" }}
                  />
                </div>

                {/* Dimensões — 3 colunas */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: "600", color: "var(--foreground)" }}>Dimensões da Embalagem (cm)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>Comprimento</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdLength}
                        onChange={(e) => setNewProdLength(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#ffffff", border: "1px solid rgba(16,185,129,0.25)", color: "var(--foreground)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>Largura</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdWidth}
                        onChange={(e) => setNewProdWidth(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#ffffff", border: "1px solid rgba(16,185,129,0.25)", color: "var(--foreground)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--foreground-muted)" }}>Altura</span>
                      <input
                        type="number"
                        min="0"
                        value={newProdHeight}
                        onChange={(e) => setNewProdHeight(e.target.value)}
                        placeholder="0"
                        className="admin-input"
                        style={{ background: "#ffffff", border: "1px solid rgba(16,185,129,0.25)", color: "var(--foreground)", padding: "0.55rem 0.7rem", borderRadius: "8px", fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SEÇÃO 6: CLASSIFICAÇÃO NA SHOPEE ── */}
              <div style={{
                background: "rgba(238, 77, 45, 0.05)",
                border: "1px solid rgba(238, 77, 45, 0.15)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#ee4d2d", textTransform: "uppercase", letterSpacing: "0.1em" }}>🧡 Classificação Shopee</span>

                {/* Categoria Shopee */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Categoria Shopee (category_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>Consulte o ID da categoria de semijoias no console Shopee.</span>
                  <input
                    type="text"
                    value={shopeeCategoryId}
                    onChange={(e) => setShopeeCategoryId(e.target.value)}
                    placeholder="Ex: 101140"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(238, 77, 45, 0.25)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Marca Shopee */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Marca Shopee (brand_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={shopeeBrandId}
                    onChange={(e) => setShopeeBrandId(e.target.value)}
                    placeholder="0 = No Brand"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(238, 77, 45, 0.25)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Canais de Envio */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>Canais de Envio Ativos</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "4px" }}>
                    {[
                      { id: "correios", label: "Correios" },
                      { id: "shopee_xpress", label: "Shopee Xpress" },
                      { id: "total_express", label: "Total Express" }
                    ].map(channel => (
                      <label key={channel.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={shopeeLogistics.includes(channel.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setShopeeLogistics(prev => [...prev, channel.id]);
                            } else {
                              setShopeeLogistics(prev => prev.filter(c => c !== channel.id));
                            }
                          }}
                          style={{ accentColor: "#ee4d2d" }}
                        />
                        {channel.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Pré-Encomenda */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(238, 77, 45, 0.04)", padding: "0.75rem", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                     <input
                       type="checkbox"
                       id="shopee-pre-order"
                       checked={shopeeIsPreOrder}
                       onChange={(e) => setShopeeIsPreOrder(e.target.checked)}
                       style={{ accentColor: "#ee4d2d", width: "16px", height: "16px", cursor: "pointer" }}
                     />
                     <label htmlFor="shopee-pre-order" style={{ fontSize: "0.8rem", color: "var(--foreground)", cursor: "pointer" }}>
                       Este produto é sob encomenda (Pre-order)
                     </label>
                  </div>
                  {shopeeIsPreOrder && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--foreground-muted)" }}>Prazo de envio (7 a 30 dias)</label>
                      <input
                        type="number"
                        min="7"
                        max="30"
                        value={shopeeDaysToShip}
                        onChange={(e) => setShopeeDaysToShip(e.target.value)}
                        className="admin-input"
                        style={{ background: "#ffffff", border: "1px solid rgba(238, 77, 45, 0.2)", padding: "0.4rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", width: "100px" }}
                      />
                    </div>
                  )}
                </div>

                {/* Publicar na Shopee Checkbox */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem 0.75rem", background: "rgba(238, 77, 45, 0.08)", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="publish-to-shopee-checkbox"
                    checked={publishToShopee}
                    onChange={(e) => setPublishToShopee(e.target.checked)}
                    style={{ accentColor: "#ee4d2d", cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="publish-to-shopee-checkbox" style={{ fontSize: "0.8rem", color: "var(--foreground)", cursor: "pointer" }}>
                    Publicar anúncio na Shopee imediatamente após salvar
                  </label>
                </div>
              </div>

              {/* ── SEÇÃO 7: CLASSIFICAÇÃO NO TIKTOK SHOP ── */}
              <div style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "1px solid rgba(0, 0, 0, 0.1)",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem"
              }}>
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--foreground)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.09-1.5-1.06-.8-1.8-1.97-2.22-3.26-.02 2.44-.01 4.88-.02 7.32-.02 2.03-.65 4.12-1.99 5.66-1.54 1.79-4.02 2.82-6.39 2.82-2.3 0-4.66-.94-6.13-2.69-1.55-1.84-2.12-4.47-1.53-6.84C.81 8.86 2.76 6.7 5.25 6.09c1.9-.47 3.96-.13 5.58.94V11.2c-1.18-.84-2.73-1.13-4.11-.75-1.39.38-2.58 1.54-3.03 2.93-.65 2.02.32 4.41 2.27 5.25 1.55.67 3.49.44 4.8-.57.94-.73 1.45-1.9 1.46-3.1.02-5.32.01-10.64.02-15.96z"/>
                  </svg>
                  TikTok Shop
                </span>

                {/* Categoria TikTok */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Categoria TikTok Shop (category_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.68rem", color: "var(--foreground-muted)" }}>ID oficial da categoria do produto no TikTok Shop.</span>
                  <input
                    type="text"
                    value={tiktokCategoryId}
                    onChange={(e) => setTiktokCategoryId(e.target.value)}
                    placeholder="Ex: 600890"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(0, 0, 0, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Marca TikTok */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--foreground)" }}>
                    Marca TikTok Shop (brand_id) <span style={{ color: "#ff4d4d" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={tiktokBrandId}
                    onChange={(e) => setTiktokBrandId(e.target.value)}
                    placeholder="0 = No Brand"
                    className="admin-input"
                    style={{ background: "#ffffff", border: "1px solid rgba(0, 0, 0, 0.15)", color: "var(--foreground)", padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}
                  />
                </div>

                {/* Informação sobre conversão de peso */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.72rem", color: "var(--foreground-muted)", background: "rgba(0,0,0,0.02)", padding: "8px", borderRadius: "6px", border: "1px dashed rgba(0,0,0,0.06)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    O peso de <strong>{newProdWeight || "0"}g</strong> será convertido automaticamente para <strong>{((Number(newProdWeight || 0)) / 1000).toFixed(3)}kg</strong> para o TikTok Shop.
                  </span>
                </div>

                {/* Publicar no TikTok Shop Checkbox */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.5rem 0.75rem", background: "rgba(0, 0, 0, 0.05)", borderRadius: "6px" }}>
                  <input
                    type="checkbox"
                    id="publish-to-tiktok-checkbox"
                    checked={publishToTiktok}
                    onChange={(e) => setPublishToTiktok(e.target.checked)}
                    style={{ accentColor: "#000000", cursor: "pointer", width: "16px", height: "16px" }}
                  />
                  <label htmlFor="publish-to-tiktok-checkbox" style={{ fontSize: "0.8rem", color: "var(--foreground)", cursor: "pointer" }}>
                    Publicar anúncio no TikTok Shop imediatamente após salvar
                  </label>
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: "flex", gap: "10px", marginTop: "0.6rem" }}>
                <button
                  type="submit"
                  disabled={isCreatingProduct}
                  style={{
                    flex: 1.3,
                    background: "var(--gold)",
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
                    background: "rgba(45, 43, 39, 0.06)",
                    color: "var(--foreground)",
                    border: "1px solid rgba(45, 43, 39, 0.12)",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    fontWeight: "500",
                    fontSize: "0.85rem",
                    cursor: "pointer"
                  }}
                >
                  Cancelar
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

      {/* Shopee OAuth Simulator Modal */}
      {showShopeeOAuth && (
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
            onClick={() => { if (!isConnectingShopee) setShowShopeeOAuth(false); }}
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
            {/* Header: Shopee styling */}
            <div style={{
              background: "#ee4d2d",
              padding: "1.2rem 1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              color: "#ffffff"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Shopee S Logo Icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span style={{ fontSize: "1.2rem", fontWeight: "700", fontFamily: "sans-serif" }}>
                  shopee <span style={{ fontWeight: "400" }}>partner</span>
                </span>
              </div>
              {!isConnectingShopee && (
                <button 
                  onClick={() => setShowShopeeOAuth(false)}
                  style={{ color: "#ffffff", padding: "0.25rem", fontSize: "1.2rem", fontWeight: "bold", background: "none", border: "none", cursor: "pointer" }}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {isConnectingShopee ? (
                <div style={{ textAlign: "center", padding: "2rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2rem" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(0, 0, 0, 0.1)",
                    borderTopColor: "#ee4d2d",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite"
                  }} />
                  <div>
                    <h4 style={{ fontWeight: "600", fontSize: "1.05rem", color: "#333" }}>Autenticando...</h4>
                    <p style={{ color: "#666666", fontSize: "0.85rem", marginTop: "4px" }}>
                      Solicitando autorização segura ao Shopee Open Platform...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#111111", marginBottom: "0.5rem" }}>
                      Conectar Fashion Shine Shopee
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "#555555", lineHeight: "1.5" }}>
                      Para vincular sua loja da Shopee e habilitar a sincronização automática de estoque e pedidos, você precisa conceder as seguintes permissões:
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
                      <span style={{ color: "#ee4d2d", fontWeight: "bold" }}>✓</span>
                      <span>Ler dados básicos do perfil da loja.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <span style={{ color: "#ee4d2d", fontWeight: "bold" }}>✓</span>
                      <span>Criar e atualizar anúncios de produtos e semijoias.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                      <span style={{ color: "#ee4d2d", fontWeight: "bold" }}>✓</span>
                      <span>Sincronizar estoque e ler pedidos de vendas.</span>
                    </div>
                  </div>

                  {/* Nickname input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "#444444" }}>
                      Nome/Apelido da Loja Shopee
                    </label>
                    <input
                      type="text"
                      value={shopeeTempAccountName}
                      onChange={(e) => setShopeeTempAccountName(e.target.value)}
                      placeholder="ex: Fashion_Shine_Shopee_Oficial"
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
                        setIsConnectingShopee(true);
                        // Persist mock connection in the backend
                        fetch("/api/auth/status", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            channel: "shopee",
                            simulate: true,
                            nickname: shopeeTempAccountName || "Fashion Shine Shopee Oficial"
                          })
                        }).then(res => {
                          if (res.ok) {
                            setShopeeAccountName(shopeeTempAccountName || "Fashion Shine Shopee Oficial");
                            setConfig(prev => ({ ...prev, shopeeConnected: true, shopeeApiKey: `shp_oauth_tok_fashion_shine_live_${Date.now()}` }));
                            addLog(`API Shopee: Loja '${shopeeTempAccountName || "Fashion Shine Shopee Oficial"}' conectada via OAuth 2.0.`, "shopee", "success");
                          } else {
                            alert("Falha ao salvar a conexão simulada.");
                          }
                          setIsConnectingShopee(false);
                          setShowShopeeOAuth(false);
                        }).catch(err => {
                          console.error(err);
                          setIsConnectingShopee(false);
                          setShowShopeeOAuth(false);
                        });
                      }}
                      style={{
                        flex: 1,
                        background: "#ee4d2d",
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
                      onClick={() => setShowShopeeOAuth(false)}
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

      {/* Shopee Credentials Warning Modal */}
      {showShopeeCredsWarning && (
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
            onClick={() => setShowShopeeCredsWarning(false)}
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
              Credenciais de API da Shopee Requeridas
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: "1.6" }}>
              Para conectar-se efetivamente à sua conta real da Shopee, você deve primeiro configurar as chaves de API do parceiro obtidas no painel de desenvolvedores do Shopee Open Platform.
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
              2. Preencha SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY<br/>
              3. Reinicie a aplicação local
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--foreground-muted)", lineHeight: "1.6" }}>
              Se você deseja apenas testar a interface do fluxo de autenticação e preencher a conta no sistema de forma demonstrativa, você pode acessar o **Simulador Interativo**.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  setShowShopeeCredsWarning(false);
                  setShowShopeeOAuth(true);
                }}
                className="btn-gold"
                style={{ flex: 1, padding: "0.6rem 0", fontSize: "0.8rem" }}
              >
                Acessar Simulador
              </button>
              <button
                onClick={() => setShowShopeeCredsWarning(false)}
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
