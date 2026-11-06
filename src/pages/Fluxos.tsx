import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Zap, Trash2, Edit2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { FlowBuilder } from "@/components/automation/FlowBuilder";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  trigger_value: string;
  created_at: string;
}

export default function Fluxos() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [flows, setFlows] = useState<AutomationFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isNewFlowDialogOpen, setIsNewFlowDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowTrigger, setNewFlowTrigger] = useState("");
  const [newFlowTriggerType, setNewFlowTriggerType] = useState("keyword");

  const fetchFlows = async () => {
    try {
      const { data: tenantData } = await supabase.rpc("get_user_tenant_id", { _user_id: user?.id });
      if (!tenantData) return;

      const { data, error } = await supabase
        .from("automation_flows")
        .select("*")
        .eq("tenant_id", tenantData)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFlows(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar fluxos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchFlows();
  }, [user]);

  const toggleFlow = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("automation_flows")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      
      if (error) throw error;
      toast.success(currentStatus ? "Fluxo pausado" : "Fluxo ativado");
      fetchFlows();
    } catch (e) {
      toast.error("Erro ao alterar status");
    }
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este fluxo?")) return;
    try {
      // 1. Clear any active states for this flow first
      await supabase.from("automation_states").delete().eq("flow_id", id);

      // 2. Delete the flow
      const { error } = await supabase
        .from("automation_flows")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Fluxo excluído");
      fetchFlows();
    } catch (e: any) {
      console.error("Erro ao excluir fluxo:", e);
      toast.error(`Erro ao excluir fluxo: ${e.message || "Verifique se há estados ativos"}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Fluxos de Automação
          </h1>
          <p className="text-muted-foreground mt-1">
            Desenhe árvores de decisão e automatize o atendimento inicial.
          </p>
        </div>
        <Button className="gap-2" onClick={() => { 
          setNewFlowName(""); 
          setNewFlowTrigger(""); 
          setIsNewFlowDialogOpen(true); 
        }}>
          <Plus className="h-4 w-4" />
          Novo Fluxo
        </Button>
      </div>

      <Dialog open={isNewFlowDialogOpen} onOpenChange={setIsNewFlowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Fluxo</DialogTitle>
            <DialogDescription>
              Defina como este fluxo será iniciado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Fluxo</Label>
              <Input 
                placeholder="Ex: Menu de Boas-vindas" 
                value={newFlowName} 
                onChange={(e) => setNewFlowName(e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tipo de Gatilho</Label>
              <Select value={newFlowTriggerType} onValueChange={setNewFlowTriggerType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o gatilho" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="welcome">Boas-vindas (Primeiro contato)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newFlowTriggerType === 'keyword' && (
              <div className="space-y-2">
                <Label>Palavra-chave Gatilho</Label>
                <Input 
                  placeholder="Ex: Oi, Ola, Ajuda" 
                  value={newFlowTrigger} 
                  onChange={(e) => setNewFlowTrigger(e.target.value)} 
                />
                <p className="text-[10px] text-muted-foreground">O fluxo iniciará quando o cliente digitar exatamente esta palavra.</p>
              </div>
            )}
            
            {newFlowTriggerType === 'welcome' && (
              <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/10">
                💡 Este fluxo será disparado automaticamente na primeira mensagem de qualquer novo cliente.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFlowDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!newFlowName) return toast.error("Nome é obrigatório");
              if (newFlowTriggerType === 'keyword' && !newFlowTrigger) return toast.error("Palavra-chave é obrigatória");
              
              try {
                const { data: tenantData, error: tenantError } = await supabase.rpc("get_user_tenant_id", { _user_id: user?.id });
                if (tenantError) throw tenantError;
                if (!tenantData) throw new Error("Tenant não encontrado");

                const { data, error } = await supabase.from("automation_flows").insert({
                  name: newFlowName,
                  trigger_type: newFlowTriggerType,
                  trigger_value: newFlowTriggerType === 'keyword' ? newFlowTrigger : null,
                  tenant_id: tenantData,
                  nodes: [],
                  edges: [],
                  is_active: true
                }).select().single();

                if (error) throw error;

                if (data) {
                  setEditingFlowId(data.id);
                  setIsNewFlowDialogOpen(false);
                  setIsBuilderOpen(true);
                  toast.success("Fluxo criado com sucesso");
                }
              } catch (err: any) {
                console.error("Erro ao criar fluxo:", err);
                toast.error(`Erro ao criar fluxo: ${err.message || 'Erro desconhecido'}`);
              }
            }}>
              Criar e Abrir Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isBuilderOpen && (
        <FlowBuilder 
          flowId={editingFlowId || undefined} 
          onClose={() => setIsBuilderOpen(false)} 
          onSave={() => {
            setIsBuilderOpen(false);
            fetchFlows();
          }} 
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-48 bg-muted/50" />
          ))
        ) : flows.length === 0 ? (
          <Card className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>Nenhum fluxo criado</CardTitle>
              <CardDescription>Comece criando seu primeiro fluxo de automação.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Fluxo
            </Button>
          </Card>
        ) : (
          flows.map((flow) => (
            <Card key={flow.id} className="group relative hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant={flow.is_active ? "default" : "secondary"}>
                    {flow.is_active ? "Ativo" : "Pausado"}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleFlow(flow.id, flow.is_active)}>
                      {flow.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-green-500" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingFlowId(flow.id); setIsBuilderOpen(true); }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteFlow(flow.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-2">{flow.name}</CardTitle>
                <CardDescription>{flow.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-semibold uppercase text-primary/70">
                    {flow.trigger_type === 'keyword' ? 'Palavra-Chave' : 
                     flow.trigger_type === 'welcome' ? 'Boas-Vindas' : 
                     flow.trigger_type}:
                  </span>
                  <span className="bg-muted px-2 py-0.5 rounded">{flow.trigger_value || "Padrão"}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
