import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Edit, Trash2, Plus, Save, X, Loader2, Eye, EyeOff, GripVertical, ThumbsUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoadmapItem } from "@/hooks/useRoadmapItems";
import { fadeUp } from "./AdminHelpers";
import { useLanguage } from "@/contexts/LanguageContext";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const iconOptions = ["Smartphone", "Bot", "FileText", "BarChart3", "MessageCircle", "CreditCard", "CalendarDays", "Bell", "Users", "Zap", "Globe", "Shield", "Palette", "Headphones", "Rocket", "Lightbulb"];

const statusColors: Record<string, string> = {
  done: "bg-primary/10 text-primary border-primary/30",
  "in-progress": "bg-warning/10 text-warning border-warning/30",
  planned: "bg-info/10 text-info border-info/30",
  idea: "bg-secondary text-muted-foreground border-border",
};

interface SortableItemProps {
  item: RoadmapItem; isEditing: boolean; saving: boolean; voteCount: number;
  statusOptions: { value: string; label: string }[];
  onEdit: () => void; onSave: () => void; onCancel: () => void;
  onDelete: () => void; onToggleVisible: () => void;
  onUpdateField: (field: keyof RoadmapItem, value: any) => void;
  labels: any;
}

function SortableItem({ item, isEditing, saving, voteCount, statusOptions, onEdit, onSave, onCancel, onDelete, onToggleVisible, onUpdateField, labels }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : undefined };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`p-3 rounded-lg border space-y-2 transition-colors ${isEditing ? "border-primary/50 bg-primary/5" : "border-border"} ${!item.visible ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none shrink-0 text-muted-foreground hover:text-foreground"><GripVertical className="h-4 w-4" /></button>
            {isEditing ? <Input className="h-8 text-sm font-semibold flex-1" value={item.title} onChange={(e) => onUpdateField("title", e.target.value)} /> : <span className="font-semibold text-xs sm:text-sm truncate">{item.title}</span>}
            {voteCount > 0 && !isEditing && <Badge variant="secondary" className="text-[9px] shrink-0 gap-0.5"><ThumbsUp className="h-2.5 w-2.5" /> {voteCount}</Badge>}
            {item.version && !isEditing && <Badge variant="outline" className="text-[9px] shrink-0">{item.version}</Badge>}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleVisible}>{item.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</Button>
            {isEditing ? (
              <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSave} disabled={saving}><Save className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}><X className="h-3 w-3" /></Button></>
            ) : <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit className="h-3 w-3" /></Button>}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
        {isEditing && (
          <>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="space-y-1 sm:col-span-2"><Label className="text-[11px] text-muted-foreground">{labels.description}</Label><Textarea className="text-sm min-h-[60px]" value={item.description} onChange={(e) => onUpdateField("description", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{labels.status}</Label><Select value={item.status} onValueChange={(v) => onUpdateField("status", v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{labels.icon}</Label><Select value={item.icon} onValueChange={(v) => onUpdateField("icon", v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{iconOptions.map((ic) => <SelectItem key={ic} value={ic}>{ic}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{labels.version}</Label><Input className="h-8 text-sm" value={item.version || ""} onChange={(e) => onUpdateField("version", e.target.value || null)} placeholder="ex: v1.0" /></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-data", { method: "POST", body: { _action: action, ...payload } });
  if (error) throw new Error(error.message || "Failed");
  return data as { success?: boolean; data?: any; error?: string };
};

export default function RoadmapTab() {
  const { t } = useLanguage();
  const r = t.admin.roadmap;
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localItems, setLocalItems] = useState<RoadmapItem[]>(() => {
    const cached = localStorage.getItem("rcs_admin_roadmap_items");
    return cached ? JSON.parse(cached) : [];
  });
  const [originalItems, setOriginalItems] = useState<RoadmapItem[]>(() => {
    const cached = localStorage.getItem("rcs_admin_roadmap_items");
    return cached ? JSON.parse(cached) : [];
  });
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>(() => {
    const cached = localStorage.getItem("rcs_admin_roadmap_votes");
    return cached ? JSON.parse(cached) : {};
  });

  const statusOptions = [
    { value: "done", label: r.statusDone },
    { value: "in-progress", label: r.statusInProgress },
    { value: "planned", label: r.statusPlanned },
    { value: "idea", label: r.statusIdea },
  ];

  const fetchItems = useCallback(async () => {
    // setLoading(true);
    try {
      const json = await callAdmin("roadmap-list-all");
      if (json.success && json.data) {
        setLocalItems(json.data);
        setOriginalItems(json.data);
        localStorage.setItem("rcs_admin_roadmap_items", JSON.stringify(json.data));
      }
    } catch (e) { console.error("Failed to load roadmap:", e); }
    setLoading(false);
  }, []);

  const fetchVoteCounts = useCallback(async () => {
    try {
      const json = await callAdmin("roadmap-vote-counts");
      if (json.success && json.data) {
        setVoteCounts(json.data);
        localStorage.setItem("rcs_admin_roadmap_votes", JSON.stringify(json.data));
      }
    } catch {}
  }, []);

  useEffect(() => { fetchItems(); fetchVoteCounts(); }, [fetchItems, fetchVoteCounts]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const updateField = (id: string, field: keyof RoadmapItem, value: any) => setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localItems.findIndex((i) => i.id === active.id);
    const newIndex = localItems.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(localItems, oldIndex, newIndex);
    const updated = newItems.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    setLocalItems(updated);
    try {
      await callAdmin("roadmap-reorder", { items: updated.map(i => ({ id: i.id, sort_order: i.sort_order })) });
      toast.success(r.orderUpdated);
    } catch { toast.error("Erro ao reordenar"); }
  };

  const handleSave = async (item: RoadmapItem) => {
    setSaving(true);
    try {
      const json = await callAdmin("roadmap-update", { id: item.id, title: item.title, description: item.description, status: item.status, icon: item.icon, version: item.version || null, sort_order: item.sort_order, visible: item.visible });
      if (json.success) { toast.success(r.savedOk); setEditingId(null); }
      else toast.error(r.saveError);
    } catch { toast.error(r.saveError); }
    setSaving(false);
  };

  const handleAdd = async () => {
    const maxOrder = localItems.reduce((max, i) => Math.max(max, i.sort_order), 0);
    try {
      const json = await callAdmin("roadmap-create", { title: "Novo item", description: "Descrição", status: "planned", icon: "Zap", sort_order: maxOrder + 1, visible: true });
      if (json.success && json.data) {
        setLocalItems((prev) => [...prev, json.data as RoadmapItem]);
        setEditingId(json.data.id);
        toast.success(r.newItemAdded);
      } else toast.error(r.createError);
    } catch { toast.error(r.createError); }
  };

  const handleDelete = async (id: string) => {
    const item = localItems.find((i) => i.id === id);
    try {
      const json = await callAdmin("roadmap-delete", { id });
      if (json.success) { setLocalItems((prev) => prev.filter((i) => i.id !== id)); toast.success(r.removed.replace("{title}", item?.title || "")); }
      else toast.error(r.deleteError);
    } catch { toast.error(r.deleteError); }
  };

  const handleToggleVisible = async (id: string) => {
    const item = localItems.find((i) => i.id === id);
    if (!item) return;
    const newVisible = !item.visible;
    try {
      const json = await callAdmin("roadmap-update", { id, visible: newVisible });
      if (json.success) { updateField(id, "visible", newVisible); toast.info(newVisible ? r.nowVisible.replace("{title}", item.title) : r.nowHidden.replace("{title}", item.title)); }
      else toast.error(r.visibilityError);
    } catch { toast.error(r.visibilityError); }
  };

  // Silent loading
  // if (loading) return ...;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div><CardTitle className="text-sm sm:text-base">{r.configTitle}</CardTitle><CardDescription className="text-xs sm:text-sm">{r.configDesc}</CardDescription></div>
            <div className="flex gap-1 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{localItems.filter(i => i.visible).length} {r.visible}</Badge>
              <Badge variant="outline" className="text-[10px]">{localItems.filter(i => !i.visible).length} {r.hidden}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {localItems.map((item) => (
                <SortableItem key={item.id} item={item} isEditing={editingId === item.id} saving={saving} voteCount={voteCounts[item.id] || 0} statusOptions={statusOptions} onEdit={() => setEditingId(item.id)} onSave={() => handleSave(item)} onCancel={() => { setEditingId(null); setLocalItems(originalItems); }} onDelete={() => handleDelete(item.id)} onToggleVisible={() => handleToggleVisible(item.id)} onUpdateField={(field, value) => updateField(item.id, field, value)} labels={r} />
              ))}
            </SortableContext>
          </DndContext>
          <div className="flex pt-2"><Button variant="outline" className="gap-1.5 w-full sm:w-auto" onClick={handleAdd}><Plus className="h-4 w-4" /> {r.newItem}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}