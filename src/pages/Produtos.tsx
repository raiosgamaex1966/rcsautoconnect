import { useState, useMemo, useRef } from "react";
import {
  Package,
  Plus,
  Search,
  ExternalLink,
  Share2,
  Trash2,
  Pencil,
  Video,
  Image as ImageIcon,
  Check,
  Copy,
  Youtube,
  Upload,
  Loader2,
  Play,
  ShoppingCart,
  Filter,
  DollarSign,
  Tag,
  Boxes,
  Eye,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProducts, type Product, extractYouTubeId } from "@/hooks/useProducts";
import { toast } from "sonner";

// Helper to format currency in BRL
function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Parse currency input (e.g., "49,90" or "49.90") to cents
function parseToCents(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

// Format cents to string for input editing ("49.90")
function centsToString(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export default function Produtos() {
  const {
    products,
    loading,
    uploadMedia,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useProducts();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPromoPrice, setFormPromoPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCheckoutUrl, setFormCheckoutUrl] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formVideoType, setFormVideoType] = useState<"none" | "upload" | "youtube">("none");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Upload loaders
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        categoryFilter === "all" ||
        (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.active) ||
        (statusFilter === "inactive" && !p.active);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.active).length;
  const withVideoCount = products.filter((p) => p.video_type !== "none" && p.video_url).length;

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("");
    setFormPrice("");
    setFormPromoPrice("");
    setFormStock("");
    setFormDescription("");
    setFormCheckoutUrl("");
    setFormImageUrl("");
    setFormVideoType("none");
    setFormVideoUrl("");
    setFormActive(true);
    setDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category || "");
    setFormPrice(centsToString(p.price_cents));
    setFormPromoPrice(p.promotional_price_cents ? centsToString(p.promotional_price_cents) : "");
    setFormStock(p.stock !== null && p.stock !== undefined ? String(p.stock) : "");
    setFormDescription(p.description || "");
    setFormCheckoutUrl(p.checkout_url || "");
    setFormImageUrl(p.image_url || "");
    setFormVideoType(p.video_type || "none");
    setFormVideoUrl(p.video_url || "");
    setFormActive(p.active);
    setDialogOpen(true);
  };

  // Image file handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).");
      return;
    }

    setUploadingImage(true);
    const toastId = toast.loading("Enviando foto do produto...");
    try {
      const url = await uploadMedia(file);
      if (url) {
        setFormImageUrl(url);
        toast.success("Foto carregada com sucesso!", { id: toastId });
      } else {
        toast.error("Não foi possível enviar a foto.", { id: toastId });
      }
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // Video file handler
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Por favor, selecione um arquivo de vídeo válido (MP4, WebM, MOV).");
      return;
    }

    // Limit to 50MB for smooth browser uploading
    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo de vídeo deve ter no máximo 50MB. Para vídeos maiores, use o link do YouTube!");
      return;
    }

    setUploadingVideo(true);
    const toastId = toast.loading("Enviando vídeo do produto (isso pode levar alguns instantes)...");
    try {
      const url = await uploadMedia(file);
      if (url) {
        setFormVideoUrl(url);
        setFormVideoType("upload");
        toast.success("Vídeo enviado com sucesso!", { id: toastId });
      } else {
        toast.error("Não foi possível enviar o vídeo.", { id: toastId });
      }
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // Form submit
  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      toast.error("O nome do produto é obrigatório.");
      return;
    }

    const priceCents = parseToCents(formPrice);
    const promoCents = formPromoPrice.trim() ? parseToCents(formPromoPrice) : null;
    const stockVal = formStock.trim() ? parseInt(formStock, 10) : null;

    if (promoCents !== null && promoCents >= priceCents && priceCents > 0) {
      toast.warning("O preço promocional normalmente é menor que o preço normal.");
    }

    setSaving(true);
    try {
      const payload: Partial<Product> = {
        name: formName.trim(),
        category: formCategory.trim(),
        price_cents: priceCents,
        promotional_price_cents: promoCents,
        stock: isNaN(stockVal as number) ? null : stockVal,
        description: formDescription.trim(),
        checkout_url: formCheckoutUrl.trim(),
        image_url: formImageUrl.trim(),
        video_type: formVideoType,
        video_url: formVideoType === "none" ? "" : formVideoUrl.trim(),
        active: formActive,
      };

      let ok = false;
      if (editingProduct) {
        ok = await updateProduct(editingProduct.id, payload);
      } else {
        ok = await createProduct(payload);
      }

      if (ok) {
        setDialogOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // Delete product confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    await deleteProduct(deleteTargetId);
    setDeleteTargetId(null);
  };

  // Quick WhatsApp share text generator
  const buildWhatsAppShareMessage = (p: Product) => {
    const priceText = p.promotional_price_cents
      ? `De ~${formatBRL(p.price_cents)}~ por apenas *${formatBRL(p.promotional_price_cents)}*!`
      : `Por apenas *${formatBRL(p.price_cents)}*!`;

    let msg = `🔥 *${p.name}*\n\n`;
    if (p.description) {
      msg += `${p.description}\n\n`;
    }
    msg += `💰 *Preço:* ${priceText}\n`;
    if (p.checkout_url) {
      msg += `🛒 *Garanta o seu aqui:* ${p.checkout_url}\n`;
    }
    if (p.video_url) {
      msg += `🎥 *Veja a demonstração em vídeo:* ${p.video_url}\n`;
    }

    return msg;
  };

  const handleShareWhatsApp = (p: Product) => {
    const text = buildWhatsAppShareMessage(p);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCopySalesText = (p: Product) => {
    const text = buildWhatsAppShareMessage(p);
    navigator.clipboard.writeText(text);
    toast.success("Mensagem de venda copiada para a área de transferência!");
  };

  const handleCopyCheckoutLink = (p: Product) => {
    if (!p.checkout_url) {
      toast.info("Este produto não possui link de checkout cadastrado.");
      return;
    }
    navigator.clipboard.writeText(p.checkout_url);
    toast.success("Link de checkout copiado!");
  };

  // YouTube embed preview helper
  const ytId = useMemo(() => {
    if (formVideoType === "youtube" && formVideoUrl) {
      return extractYouTubeId(formVideoUrl);
    }
    return null;
  }, [formVideoType, formVideoUrl]);

  return (
    <div className="p-3 sm:p-6 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Produtos & Catálogo
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Cadastre seus produtos com fotos, vídeos demonstrativos e links de vendas para você e para a IA atender e vender no WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total de Produtos</p>
              <h3 className="text-2xl font-bold mt-1">{totalProducts}</h3>
            </div>
            <div className="p-3 bg-muted rounded-full">
              <Boxes className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Produtos Ativos</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {activeProducts}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-full">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Com Vídeo Demonstrativo</p>
              <h3 className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {withVideoCount}
              </h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/60">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, descrição ou categoria..."
              className="pl-9 h-9"
            />
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-9">
              <Tag className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onValueChange={(val: any) => setStatusFilter(val)}
          >
            <SelectTrigger className="w-full sm:w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Apenas Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center justify-end gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("grid")}
            title="Visualização em Grade"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setViewMode("table")}
            title="Visualização em Tabela"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando seus produtos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-muted/60 rounded-full">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              {search || categoryFilter !== "all" || statusFilter !== "all"
                ? "Nenhum produto corresponde aos filtros aplicados. Tente limpar os filtros."
                : "Você ainda não possui produtos cadastrados. Comece adicionando seu primeiro produto com fotos, vídeos e links de vendas!"}
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="mt-2">
            <Plus className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Produto
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const hasPromo = !!p.promotional_price_cents && p.promotional_price_cents < p.price_cents;
            const hasVideo = p.video_type !== "none" && !!p.video_url;
            const ytVidId = p.video_type === "youtube" ? extractYouTubeId(p.video_url) : null;
            const displayImage = p.image_url || (ytVidId ? `https://img.youtube.com/vi/${ytVidId}/hqdefault.jpg` : null);

            return (
              <Card
                key={p.id}
                className="overflow-hidden border border-border/70 flex flex-col transition-all hover:shadow-md hover:border-border"
              >
                {/* Product Thumbnail / Media Preview */}
                <div
                  className="relative aspect-video bg-muted/40 flex items-center justify-center overflow-hidden cursor-pointer group"
                  onClick={() => setPreviewProduct(p)}
                >
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-4">
                      <ImageIcon className="h-10 w-10 mb-1" />
                      <span className="text-xs">Sem foto</span>
                    </div>
                  )}

                  {/* Active / Inactive overlay badge */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge
                      variant={p.active ? "default" : "secondary"}
                      className={`text-[11px] font-medium shadow-sm ${
                        p.active
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-muted/90 text-muted-foreground"
                      }`}
                    >
                      {p.active ? "Ativo" : "Pausado"}
                    </Badge>
                    {p.category && (
                      <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px]">
                        {p.category}
                      </Badge>
                    )}
                  </div>

                  {/* Media Indicator Badges */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {hasVideo && (
                      <Badge
                        variant="secondary"
                        className="bg-black/75 hover:bg-black/85 text-white backdrop-blur-sm flex items-center gap-1 text-[11px]"
                      >
                        {p.video_type === "youtube" ? (
                          <Youtube className="h-3 w-3 text-red-500" />
                        ) : (
                          <Video className="h-3 w-3 text-blue-400" />
                        )}
                        Vídeo
                      </Badge>
                    )}
                  </div>

                  {/* Hover play / inspect overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-full bg-white/90 text-black shadow-lg">
                      <Eye className="h-5 w-5" />
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3
                      className="font-semibold text-base leading-tight line-clamp-1 hover:underline cursor-pointer"
                      onClick={() => setPreviewProduct(p)}
                      title={p.name}
                    >
                      {p.name}
                    </h3>
                    {p.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mt-1">
                        Sem descrição informada
                      </p>
                    )}
                  </div>

                  {/* Pricing and Stock */}
                  <div className="pt-2 border-t border-border/40 flex items-end justify-between">
                    <div>
                      {hasPromo ? (
                        <div>
                          <span className="text-xs text-muted-foreground line-through block">
                            {formatBRL(p.price_cents)}
                          </span>
                          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            {formatBRL(p.promotional_price_cents)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-foreground">
                          {formatBRL(p.price_cents)}
                        </span>
                      )}
                    </div>

                    {p.stock !== null && p.stock !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        Estoque: <strong className="text-foreground">{p.stock}</strong>
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-1.5 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => handleShareWhatsApp(p)}
                      title="Compartilhar no WhatsApp com mensagem pronta"
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1" />
                      WhatsApp
                    </Button>

                    {p.checkout_url && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyCheckoutLink(p)}
                        title="Copiar Link de Compra / Checkout"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEdit(p)}
                      title="Editar Produto"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTargetId(p.id)}
                      title="Excluir Produto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="border border-border/70 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Mídia</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Vídeo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => {
                const hasPromo = !!p.promotional_price_cents && p.promotional_price_cents < p.price_cents;
                const ytVidId = p.video_type === "youtube" ? extractYouTubeId(p.video_url) : null;
                const displayImage = p.image_url || (ytVidId ? `https://img.youtube.com/vi/${ytVidId}/hqdefault.jpg` : null);

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div
                        className="w-12 h-12 rounded-md bg-muted overflow-hidden flex items-center justify-center cursor-pointer"
                        onClick={() => setPreviewProduct(p)}
                      >
                        {displayImage ? (
                          <img src={displayImage} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium hover:underline cursor-pointer" onClick={() => setPreviewProduct(p)}>
                        {p.name}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {p.description || "Sem descrição"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.category ? <Badge variant="outline">{p.category}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      {hasPromo ? (
                        <div>
                          <span className="text-xs line-through text-muted-foreground mr-1">
                            {formatBRL(p.price_cents)}
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatBRL(p.promotional_price_cents)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">{formatBRL(p.price_cents)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.stock !== null && p.stock !== undefined ? p.stock : "—"}
                    </TableCell>
                    <TableCell>
                      {p.video_type !== "none" && p.video_url ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          {p.video_type === "youtube" ? <Youtube className="h-3 w-3 text-red-500" /> : <Video className="h-3 w-3 text-blue-400" />}
                          {p.video_type === "youtube" ? "YouTube" : "Upload"}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "default" : "secondary"}>
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600"
                          onClick={() => handleShareWhatsApp(p)}
                          title="Enviar no WhatsApp"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(p)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTargetId(p.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do produto, envie fotos ou vídeos demonstrativos e configure o link de checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome & Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name">Nome do Produto *</Label>
                <Input
                  id="prod-name"
                  placeholder="Ex: Curso Completo de Automação"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-category">Categoria</Label>
                <Input
                  id="prod-category"
                  placeholder="Ex: Cursos, Roupas, Eletrônicos..."
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>
            </div>

            {/* Preços & Estoque */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prod-price">Preço Normal (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    id="prod-price"
                    type="number"
                    step="0.01"
                    placeholder="99.90"
                    className="pl-9"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-promo-price">Preço Promocional (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                    R$
                  </span>
                  <Input
                    id="prod-promo-price"
                    type="number"
                    step="0.01"
                    placeholder="Opcional"
                    className="pl-9"
                    value={formPromoPrice}
                    onChange={(e) => setFormPromoPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-stock">Estoque</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  placeholder="Ilimitado se vazio"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-desc">Breve Descrição do Produto</Label>
              <Textarea
                id="prod-desc"
                placeholder="Descreva o que o produto faz, benefícios e características principais. Esta descrição será usada pela IA para tirar dúvidas dos clientes."
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {/* Link de Vendas / Checkout */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-checkout">Link de Vendas / Checkout</Label>
              <div className="relative">
                <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="prod-checkout"
                  placeholder="https://pay.kiwify.com.br/... ou Mercado Pago, Hotmart, Stripe"
                  className="pl-9"
                  value={formCheckoutUrl}
                  onChange={(e) => setFormCheckoutUrl(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                A IA enviará este link quando o cliente solicitar comprar o produto no WhatsApp.
              </p>
            </div>

            {/* Foto do Produto */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary" /> Imagem do Produto
              </Label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {formImageUrl ? (
                  <div className="relative w-24 h-24 rounded-lg border overflow-hidden bg-muted flex-shrink-0 group">
                    <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl("")}
                      className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground bg-muted/30 flex-shrink-0">
                    <ImageIcon className="h-6 w-6 mb-1 opacity-50" />
                    <span className="text-[10px]">Sem foto</span>
                  </div>
                )}

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                      className="w-full sm:w-auto"
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Enviando foto...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Enviar do Computador
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    placeholder="Ou cole a URL direta da imagem aqui..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Vídeo Demonstrativo */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-blue-500" /> Vídeo Demonstrativo
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={formVideoType === "none" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => {
                      setFormVideoType("none");
                      setFormVideoUrl("");
                    }}
                  >
                    Nenhum
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formVideoType === "upload" ? "secondary" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => setFormVideoType("upload")}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Arquivo Local
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formVideoType === "youtube" ? "secondary" : "ghost"}
                    className="h-7 text-xs text-red-500 hover:text-red-600"
                    onClick={() => setFormVideoType("youtube")}
                  >
                    <Youtube className="h-3 w-3 mr-1" /> YouTube
                  </Button>
                </div>
              </div>

              {/* Sub-interface for Video Upload */}
              {formVideoType === "upload" && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={handleVideoFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingVideo}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      {uploadingVideo ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Enviando vídeo...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Selecionar Vídeo (MP4/WebM até 50MB)
                        </>
                      )}
                    </Button>
                    {formVideoUrl && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Vídeo carregado com sucesso!
                      </span>
                    )}
                  </div>

                  {formVideoUrl && (
                    <div className="mt-2 rounded-md overflow-hidden max-h-48 bg-black">
                      <video src={formVideoUrl} controls className="w-full max-h-48 mx-auto" />
                    </div>
                  )}
                </div>
              )}

              {/* Sub-interface for YouTube */}
              {formVideoType === "youtube" && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="yt-url" className="text-xs text-muted-foreground">
                      Link do Vídeo no YouTube
                    </Label>
                    <div className="relative">
                      <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                      <Input
                        id="yt-url"
                        placeholder="Ex: https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                        className="pl-9 h-9 text-xs"
                        value={formVideoUrl}
                        onChange={(e) => setFormVideoUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  {ytId && (
                    <div className="mt-2 aspect-video max-h-48 rounded-md overflow-hidden bg-black mx-auto">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                        title="YouTube Preview"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ativo / Inativo Switch */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="space-y-0.5">
                <Label htmlFor="prod-active" className="text-sm font-medium">
                  Produto Ativo no Catálogo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, o produto é apresentado pela IA e fica disponível para vendas.
                </p>
              </div>
              <Switch
                id="prod-active"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveProduct}
              disabled={saving || uploadingImage || uploadingVideo}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : editingProduct ? (
                "Salvar Alterações"
              ) : (
                "Cadastrar Produto"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRODUCT PREVIEW MODAL */}
      <Dialog open={!!previewProduct} onOpenChange={(open) => !open && setPreviewProduct(null)}>
        {previewProduct && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            {/* Media Player or Large Image */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {previewProduct.video_type === "youtube" && previewProduct.video_url ? (
                (() => {
                  const id = extractYouTubeId(previewProduct.video_url);
                  return id ? (
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
                      title={previewProduct.name}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="text-white text-xs">Vídeo do YouTube indisponível</div>
                  );
                })()
              ) : previewProduct.video_type === "upload" && previewProduct.video_url ? (
                <video
                  src={previewProduct.video_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : previewProduct.image_url ? (
                <img
                  src={previewProduct.image_url}
                  alt={previewProduct.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/50">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <span className="text-sm">Sem mídia anexada</span>
                </div>
              )}

              {/* Status badge */}
              <div className="absolute top-3 left-3 flex gap-2">
                <Badge
                  className={
                    previewProduct.active
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {previewProduct.active ? "Ativo no Catálogo" : "Pausado"}
                </Badge>
                {previewProduct.category && (
                  <Badge variant="secondary" className="backdrop-blur-sm bg-black/60 text-white">
                    {previewProduct.category}
                  </Badge>
                )}
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{previewProduct.name}</h2>
                <div className="flex items-baseline gap-3 mt-1.5">
                  {previewProduct.promotional_price_cents &&
                  previewProduct.promotional_price_cents < previewProduct.price_cents ? (
                    <>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(previewProduct.promotional_price_cents)}
                      </span>
                      <span className="text-sm line-through text-muted-foreground">
                        {formatBRL(previewProduct.price_cents)}
                      </span>
                      <Badge variant="outline" className="text-emerald-600 border-emerald-500 text-xs">
                        Promoção
                      </Badge>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">
                      {formatBRL(previewProduct.price_cents)}
                    </span>
                  )}

                  {previewProduct.stock !== null && previewProduct.stock !== undefined && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Estoque disponível: <strong>{previewProduct.stock}</strong> un
                    </span>
                  )}
                </div>
              </div>

              {previewProduct.description && (
                <div className="prose dark:prose-invert text-sm text-muted-foreground whitespace-pre-line bg-muted/30 p-3.5 rounded-lg border border-border/40">
                  {previewProduct.description}
                </div>
              )}

              {/* Action Buttons in Modal */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {previewProduct.checkout_url && (
                  <Button
                    className="flex-1 bg-primary text-primary-foreground font-semibold"
                    onClick={() => window.open(previewProduct.checkout_url, "_blank")}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Comprar Agora (Página de Vendas)
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-80" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onClick={() => handleShareWhatsApp(previewProduct)}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar no WhatsApp
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleCopySalesText(previewProduct)}
                  title="Copiar mensagem pronta de vendas"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Mensagem
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o produto permanentemente do seu catálogo. A IA do WhatsApp não irá mais recomendá-lo nem enviar seus links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Sim, Excluir Produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
