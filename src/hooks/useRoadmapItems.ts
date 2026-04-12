import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: string;
  icon: string;
  version: string | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export function useRoadmapItems() {
  const [items, setItems] = useState<RoadmapItem[]>(() => {
    const cached = localStorage.getItem("zapmax_roadmap_items");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    // setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-api", {
        body: { _action: "roadmap-items-list" },
      });
      if (!error && data?.success && data.data) {
        setItems(data.data as RoadmapItem[]);
        localStorage.setItem("zapmax_roadmap_items", JSON.stringify(data.data));
      }
    } catch (e) {
      console.error("Failed to fetch roadmap items:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, refetch: fetchItems };
}