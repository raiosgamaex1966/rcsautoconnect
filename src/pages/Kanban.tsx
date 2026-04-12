import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Loader2, GripVertical, Pencil, Trash2, X, Phone,
  MessageCircle, MoreHorizontal, Tag, ChevronDown, ChevronUp, Zap, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useKanban, type KanbanConversation } from "@/hooks/useKanban";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { useSortable, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePlanLimits } from "@/hooks/usePlanLimits";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

function ConversationCard({
  conv,
  columns,
  onMove,
  onOpenChat,
  isMobile,
}: {
  conv: KanbanConversation;
  columns: { id: string; name: string; color: string }[];
  onMove: (convId: string, colId: string | null) => void;
  onOpenChat: (convId: string) => void;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `conv:${conv.id}`,
    data: { type: "conversation", conversationId: conv.id, columnId: conv.kanban_column_id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    scale: isDragging ? 0.95 : 1,
    transition: isDragging ? "none" : "opacity 0.2s, scale 0.2s",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card
        ref={setNodeRef}
        style={style}
        className={`p-2.5 sm:p-3 space-y-1.5 sm:space-y-2 transition-all cursor-pointer group border ${
          isDragging ? "border-primary/50 shadow-lg shadow-primary/10 z-50" : "hover:border-primary/30"
        }`}
      >
        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {!isMobile && (
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 shrink-0"
                aria-label="Arrastar card"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] sm:text-xs shrink-0">
              {conv.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium truncate">{conv.contact.name}</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                <Phone className="h-2.5 w-2.5" /> {conv.contact.phone}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={`h-6 w-6 transition-opacity ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenChat(conv.id)}>
                <MessageCircle className="h-3.5 w-3.5 mr-2" /> Abrir conversa
              </DropdownMenuItem>
              {columns.map((col) => (
                <DropdownMenuItem key={col.id} onClick={() => onMove(conv.id, col.id)}>
                  <div className="h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: col.color }} />
                  Mover para {col.name}
                </DropdownMenuItem>
              ))}
              {conv.kanban_column_id && (
                <DropdownMenuItem onClick={() => onMove(conv.id, null)}>
                  <X className="h-3.5 w-3.5 mr-2" /> Remover do Kanban
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {conv.contact.tags && conv.contact.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {conv.contact.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {conv.unread_count > 0 && (
          <Badge className="text-[10px]">{conv.unread_count} não lida(s)</Badge>
        )}
      </Card>
    </motion.div>
  );
}

function SortableColumn({
  column,
  convs,
  allColumns,
  onMove,
  onOpenChat,
  onEdit,
  onDelete,
  isMobile,
}: {
  column: { id: string; name: string; color: string };
  convs: KanbanConversation[];
  allColumns: { id: string; name: string; color: string }[];
  onMove: (convId: string, colId: string | null) => void;
  onOpenChat: (convId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `col:${column.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `drop:${column.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col bg-secondary/30 rounded-xl border border-border ${
        isMobile ? "w-full" : "flex-shrink-0 w-72"
      }`}
    >
      <div className="flex items-center justify-between p-2.5 sm:p-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {!isMobile && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          <span className="text-xs sm:text-sm font-semibold truncate">{column.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5">{convs.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {(!isMobile || !collapsed) && (
        <div
          ref={setDropRef}
          className={`flex-1 p-2 space-y-2 overflow-y-auto transition-all duration-200 rounded-b-xl ${
            isMobile ? "max-h-[50vh]" : "max-h-[calc(100vh-14rem)]"
          } ${isOver ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
        >
          {convs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 sm:py-6">
              {isMobile ? "Use o menu para mover leads" : "Arraste conversas aqui"}
            </p>
          )}
          <AnimatePresence mode="popLayout">
            {convs.map((conv) => (
              <ConversationCard
                key={conv.id}
                conv={conv}
                columns={allColumns.filter((c) => c.id !== column.id)}
                onMove={onMove}
                onOpenChat={onOpenChat}
                isMobile={isMobile}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function Kanban() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    columns, conversations, loading,
    createColumn, updateColumn, deleteColumn,
    moveConversation, reorderColumns,
  } = useKanban();
  const { plan, messageLimitReached, loading: planLimitsLoading, refetch: refetchPlanLimits } = usePlanLimits();

  const [showCreateCol, setShowCreateCol] = useState(false);
  const [editCol, setEditCol] = useState<{ id: string; name: string; color: string } | null>(null);
  const [deleteColId, setDeleteColId] = useState<string | null>(null);
  const [colName, setColName] = useState("");
  const [colColor, setColColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [assignColId, setAssignColId] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  const unassignedConvs = conversations.filter((c) => !c.kanban_column_id);
  const { setNodeRef: setUnassignedDropRef, isOver: isUnassignedOver } = useDroppable({ id: "drop:unassigned" });

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("conv:")) setActiveConvId(id.replace("conv:", ""));
  };

  const activeConv = activeConvId ? conversations.find((c) => c.id === activeConvId) : null;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("col:") && overId.startsWith("col:")) {
      const ids = columns.map((c) => `col:${c.id}`);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = [...ids];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, activeId);
      await reorderColumns(reordered.map((id) => id.replace("col:", "")));
      return;
    }

    if (activeId.startsWith("conv:")) {
      const convId = activeId.replace("conv:", "");
      const ac = conversations.find((c) => c.id === convId);
      if (!ac) return;
      let targetColId: string | null = ac.kanban_column_id;
      if (overId.startsWith("drop:")) {
        const raw = overId.replace("drop:", "");
        targetColId = raw === "unassigned" ? null : raw;
      } else if (overId.startsWith("conv:")) {
        const oc = conversations.find((c) => c.id === overId.replace("conv:", ""));
        if (oc) targetColId = oc.kanban_column_id;
      } else if (overId.startsWith("col:")) {
        targetColId = overId.replace("col:", "");
      }
      if (targetColId === ac.kanban_column_id) return;
      await handleMoveConv(convId, targetColId);
    }
  };

  const handleCreateColumn = async () => {
    if (!colName.trim()) return;
    setSaving(true);
    const result = await createColumn(colName.trim(), colColor);
    if (result.error) toast.error(result.error);
    else { toast.success("Coluna criada!"); setShowCreateCol(false); setColName(""); }
    setSaving(false);
  };

  const handleUpdateColumn = async () => {
    if (!editCol || !colName.trim()) return;
    setSaving(true);
    const result = await updateColumn(editCol.id, { name: colName.trim(), color: colColor });
    if (result.error) toast.error(result.error);
    else { toast.success("Coluna atualizada!"); setEditCol(null); setColName(""); }
    setSaving(false);
  };

  const handleDeleteColumn = async () => {
    if (!deleteColId) return;
    const result = await deleteColumn(deleteColId);
    if (result.error) toast.error(result.error);
    else toast.success("Coluna excluída!");
    setDeleteColId(null);
  };

  const handleMoveConv = async (convId: string, colId: string | null) => {
    const result = await moveConversation(convId, colId);
    if (result.error) toast.error(result.error);
  };

  const handleOpenChat = (convId: string) => navigate(`/conversas?id=${convId}`);

  // Silent loading
  // if (loading) { ... }

  if (!planLimitsLoading && messageLimitReached) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-background/95 backdrop-blur-sm h-[calc(100vh-4rem)]">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-2 animate-pulse">
          <Zap className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Limite de Mensagens Atingido</h2>
        <p className="text-muted-foreground max-w-sm">
          Seu plano ({plan?.name}) atingiu o limite mensal de <strong>{plan?.max_messages}</strong> mensagens. 
          Acesso ao Kanban bloqueado para garantir a integridade do sistema.
          Atualize seu plano para continuar atendendo seus clientes.
        </p>
        <div className="flex gap-3 pt-2">
          <Button onClick={() => navigate("/planos")} className="font-bold">
            Ver Planos e Upgrade
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-6 space-y-3 sm:space-y-4 w-full h-full">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold">Kanban de Leads</h1>
          <p className="text-[10px] sm:text-sm text-muted-foreground">
            {conversations.length} conversa(s) · {columns.length} etapa(s)
          </p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShowAssign(true)} size={isMobile ? "icon" : "default"} className="text-xs sm:text-sm">
            <Tag className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Atribuir Lead</span>}
          </Button>
          <Button onClick={() => { setShowCreateCol(true); setColName(""); setColColor(COLORS[0]); }} size={isMobile ? "icon" : "default"} className="text-xs sm:text-sm">
            <Plus className="h-4 w-4" />
            {!isMobile && <span className="ml-1">Nova Etapa</span>}
          </Button>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-muted-foreground">
          <MessageCircle className="h-10 sm:h-12 w-10 sm:w-12 mb-3 opacity-30" />
          <p className="font-medium text-sm">Nenhuma etapa criada</p>
          <p className="text-xs text-center px-4">Crie etapas como "Novo Lead", "Em Negociação", "Fechado" etc.</p>
          <Button className="mt-4" onClick={() => { setShowCreateCol(true); setColName(""); setColColor(COLORS[0]); }}>
            <Plus className="h-4 w-4 mr-1" /> Criar primeira etapa
          </Button>
        </div>
      ) : (
        <div className={isMobile ? "flex flex-col gap-3 pb-4" : "flex gap-4 overflow-x-auto pb-4"}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={(e) => { setActiveConvId(null); handleDragEnd(e); }}>
            <SortableContext items={columns.map((c) => `col:${c.id}`)} strategy={horizontalListSortingStrategy}>
              {columns.map((col) => (
                <SortableColumn
                  key={col.id}
                  column={col}
                  convs={conversations.filter((c) => c.kanban_column_id === col.id)}
                  allColumns={columns}
                  onMove={handleMoveConv}
                  onOpenChat={handleOpenChat}
                  onEdit={() => { setEditCol(col); setColName(col.name); setColColor(col.color); }}
                  onDelete={() => setDeleteColId(col.id)}
                  isMobile={isMobile}
                />
              ))}
            </SortableContext>

            {!isMobile && (
              <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                {activeConv ? (
                  <Card className="p-3 space-y-2 border-primary shadow-xl shadow-primary/20 rotate-2 w-72 opacity-90">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {activeConv.contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{activeConv.contact.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {activeConv.contact.phone}
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : null}
              </DragOverlay>
            )}
          </DndContext>

          {/* Unassigned column */}
          {unassignedConvs.length > 0 && (
            <div className={`flex flex-col bg-muted/30 rounded-xl border border-dashed border-border ${isMobile ? "w-full" : "flex-shrink-0 w-72"}`}>
              <div className="flex items-center gap-2 p-2.5 sm:p-3 border-b border-border">
                <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
                <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Sem etapa</span>
                <Badge variant="outline" className="text-[10px] px-1.5">{unassignedConvs.length}</Badge>
              </div>
              <div
                ref={setUnassignedDropRef}
                className={`flex-1 p-2 space-y-2 overflow-y-auto transition-all duration-200 rounded-b-xl ${
                  isMobile ? "max-h-[50vh]" : "max-h-[calc(100vh-14rem)]"
                } ${isUnassignedOver ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
              >
                {unassignedConvs.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conv={conv}
                    columns={columns}
                    onMove={handleMoveConv}
                    onOpenChat={handleOpenChat}
                    isMobile={isMobile}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Column Dialog */}
      <Dialog open={showCreateCol} onOpenChange={setShowCreateCol}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Ex: Novo Lead" value={colName} onChange={(e) => setColName(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColColor(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${colColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <DialogFooter className="flex-row gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setShowCreateCol(false)} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button onClick={handleCreateColumn} disabled={saving || !colName.trim()} className="flex-1 sm:flex-none">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Criar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Column Dialog */}
      <Dialog open={!!editCol} onOpenChange={(o) => { if (!o) setEditCol(null); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome da etapa" value={colName} onChange={(e) => setColName(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColColor(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${colColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
            <DialogFooter className="flex-row gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setEditCol(null)} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button onClick={handleUpdateColumn} disabled={saving || !colName.trim()} className="flex-1 sm:flex-none">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Column Confirm */}
      <AlertDialog open={!!deleteColId} onOpenChange={(o) => { if (!o) setDeleteColId(null); }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              As conversas desta etapa serão movidas para "Sem etapa". Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 sm:flex-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteColumn} className="flex-1 sm:flex-none">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Lead Dialog */}
      <Dialog open={showAssign} onOpenChange={(o) => { setShowAssign(o); if (!o) { setSelectedLeads(new Set()); setAssignColId(""); } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Lead a uma Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {unassignedConvs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todas as conversas já estão em etapas.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedLeads.size} de {unassignedConvs.length} selecionado(s)
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        if (selectedLeads.size === unassignedConvs.length) {
                          setSelectedLeads(new Set());
                        } else {
                          setSelectedLeads(new Set(unassignedConvs.map((c) => c.id)));
                        }
                      }}
                    >
                      {selectedLeads.size === unassignedConvs.length ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-1 border rounded-lg p-2">
                    {unassignedConvs.map((conv) => (
                      <label
                        key={conv.id}
                        className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedLeads.has(conv.id) ? "bg-primary/10" : "hover:bg-secondary/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-border h-4 w-4 accent-primary"
                          checked={selectedLeads.has(conv.id)}
                          onChange={() => {
                            setSelectedLeads((prev) => {
                              const next = new Set(prev);
                              if (next.has(conv.id)) next.delete(conv.id);
                              else next.add(conv.id);
                              return next;
                            });
                          }}
                        />
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                          {conv.contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{conv.contact.name}</p>
                          <p className="text-[10px] text-muted-foreground">{conv.contact.phone}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <Select value={assignColId} onValueChange={setAssignColId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                          {col.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <DialogFooter className="flex-row gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setShowAssign(false)} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!assignColId || selectedLeads.size === 0) return;
                  setSaving(true);
                  for (const convId of selectedLeads) {
                    await moveConversation(convId, assignColId);
                  }
                  toast.success(`${selectedLeads.size} lead(s) atribuído(s)!`);
                  setShowAssign(false);
                  setAssignColId("");
                  setSelectedLeads(new Set());
                  setSaving(false);
                }}
                disabled={!assignColId || saving || selectedLeads.size === 0}
                className="flex-1 sm:flex-none"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Atribuir ({selectedLeads.size})
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
