import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  price_cents: number;
  promotional_price_cents: number | null;
  category: string;
  image_url: string;
  additional_images: string[];
  video_type: "none" | "upload" | "youtube";
  video_url: string;
  checkout_url: string;
  stock: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Load tenant ID
  useEffect(() => {
    if (!user) return;
    const loadTenant = async () => {
      const { data: tId } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
      let finalTenant = tId;
      if (!finalTenant) {
        const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
        finalTenant = prof?.tenant_id;
      }
      setTenantId(finalTenant || null);
    };
    loadTenant();
  }, [user]);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching products:", error);
        toast.error("Erro ao carregar produtos");
      } else {
        const mapped = (data || []).map((p: any) => ({
          ...p,
          additional_images: Array.isArray(p.additional_images) ? p.additional_images : [],
          video_type: p.video_type || "none"
        })) as Product[];
        setProducts(mapped);
      }
    } catch (err) {
      console.error("Exception fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user, fetchProducts]);

  const uploadMedia = async (file: File): Promise<string | null> => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return null;
    }

    try {
      const ext = file.name.split(".").pop() || "bin";
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${tenantId}/${Date.now()}_${cleanName}`;

      let bucket = "products-media";
      let { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadErr) {
        // Fallback to whatsapp-media
        bucket = "whatsapp-media";
        const fbRes = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type, upsert: false });
        uploadErr = fbRes.error;
      }

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        toast.error(`Falha no upload do arquivo: ${uploadErr.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error("Exception uploading media:", err);
      toast.error(`Erro ao subir arquivo: ${err.message || String(err)}`);
      return null;
    }
  };

  const createProduct = async (productData: Partial<Product>): Promise<boolean> => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return false;
    }

    try {
      const payload: any = {
        tenant_id: tenantId,
        name: productData.name?.trim() || "Novo Produto",
        description: productData.description?.trim() || "",
        price_cents: productData.price_cents ?? 0,
        promotional_price_cents: productData.promotional_price_cents ?? null,
        category: productData.category?.trim() || "",
        image_url: productData.image_url?.trim() || "",
        additional_images: productData.additional_images || [],
        video_type: productData.video_type || "none",
        video_url: productData.video_url?.trim() || "",
        checkout_url: productData.checkout_url?.trim() || "",
        stock: productData.stock ?? null,
        active: productData.active ?? true,
      };

      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        console.error("Error creating product:", error);
        toast.error(`Erro ao criar produto: ${error.message}`);
        return false;
      }

      toast.success("Produto cadastrado com sucesso!");
      await fetchProducts();
      return true;
    } catch (err) {
      console.error("Exception creating product:", err);
      toast.error("Erro ao criar produto");
      return false;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<boolean> => {
    try {
      const payload: any = { ...updates };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", id);

      if (error) {
        console.error("Error updating product:", error);
        toast.error(`Erro ao atualizar produto: ${error.message}`);
        return false;
      }

      toast.success("Produto atualizado!");
      await fetchProducts();
      return true;
    } catch (err) {
      console.error("Exception updating product:", err);
      toast.error("Erro ao atualizar produto");
      return false;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        console.error("Error deleting product:", error);
        toast.error(`Erro ao excluir produto: ${error.message}`);
        return false;
      }

      toast.success("Produto excluído!");
      await fetchProducts();
      return true;
    } catch (err) {
      console.error("Exception deleting product:", err);
      toast.error("Erro ao excluir produto");
      return false;
    }
  };

  return {
    products,
    loading,
    tenantId,
    fetchProducts,
    uploadMedia,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
