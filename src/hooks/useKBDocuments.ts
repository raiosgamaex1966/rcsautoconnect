import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface KBDocument {
  id: string;
  tenant_id: string;
  title: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  content: string;
  processing_status: string;
  created_at: string;
}

export function useKBDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    // setLoading(true);

    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kb-list" },
    });

    if (error) {
      console.error("Error fetching kb docs:", error);
      setLoading(false);
      return;
    }

    if (data?.success) {
      const docs = (data.data as KBDocument[]) || [];
      setDocuments(docs);
      if (docs.length > 0) setTenantId(docs[0].tenant_id);
    }

    // Also get tenant id if no docs
    if (!tenantId) {
      const { data: tid } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
      if (tid) setTenantId(tid);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const processDocument = useCallback(async (documentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ document_id: documentId }),
        }
      );

      if (!response.ok) {
        console.error("Process error:", response.status);
        return false;
      }

      const result = await response.json();
      return result.success === true;
    } catch (e) {
      console.error("Process error:", e);
      return false;
    }
  }, []);

  const upload = useCallback(async (file: File, title: string, docType: string) => {
    if (!tenantId) return false;

    const ext = file.name.split(".").pop() || "bin";
    const filePath = `${tenantId}/${crypto.randomUUID()}.${ext}`;

    // Storage upload stays client-side (uses RLS)
    const { error: uploadError } = await supabase.storage
      .from("knowledge-base")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return false;
    }

    // DB insert via edge function
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: {
        _action: "kb-insert",
        title,
        doc_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size_bytes: file.size,
      },
    });

    if (error || !data?.success) {
      console.error("DB error:", data?.error || error);
      await supabase.storage.from("knowledge-base").remove([filePath]);
      return false;
    }

    await load();

    // Auto-process in background
    processDocument(data.data.id).then((ok) => {
      if (ok) load();
    });

    return true;
  }, [tenantId, load, processDocument]);

  const remove = useCallback(async (doc: KBDocument) => {
    const { data, error } = await supabase.functions.invoke("data-api", {
      body: { _action: "kb-delete", id: doc.id },
    });
    if (error || !data?.success) {
      console.error("Delete error:", data?.error || error);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }, []);

  const reprocess = useCallback(async (doc: KBDocument) => {
    await supabase.functions.invoke("data-api", {
      body: { _action: "kb-reprocess", id: doc.id },
    });
    await load();
    const ok = await processDocument(doc.id);
    if (ok) await load();
    return ok;
  }, [load, processDocument]);

  return { documents, loading, upload, remove, reprocess, tenantId };
}
