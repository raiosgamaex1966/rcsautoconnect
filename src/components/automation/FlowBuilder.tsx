import { useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageSquare, List, Zap, Save, ArrowLeft, GitBranch, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { MessageNode } from "./nodes/MessageNode";
import { MenuNode } from "./nodes/MenuNode";
import { ActionNode } from "./nodes/ActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { HttpNode } from "./nodes/HttpNode";

const nodeTypes = {
  message: MessageNode,
  menu: MenuNode,
  action: ActionNode,
  condition: ConditionNode,
  http_request: HttpNode,
};

interface FlowBuilderProps {
  flowId?: string;
  onClose: () => void;
  onSave: () => void;
  user?: any;
}

export function FlowBuilder({ flowId, onClose, onSave, user }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [name, setName] = useState("Novo Fluxo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (flowId) {
      const loadFlow = async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from("automation_flows")
          .select("*")
          .eq("id", flowId)
          .single();
        
        if (!error && data) {
          setName(data.name);
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
        }
        setLoading(false);
      };
      loadFlow();
    }
  }, [flowId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const saveFlow = async () => {
    setLoading(true);
    try {
      const { data: tenantData } = await supabase.rpc("get_user_tenant_id", { _user_id: user?.id });
      
      const flowData = {
        name,
        nodes: nodes,
        edges: edges,
        tenant_id: tenantData,
      };

      let error;
      if (flowId) {
        const { error: err } = await supabase
          .from("automation_flows")
          .update(flowData)
          .eq("id", flowId);
        error = err;
      } else {
        const { error: err } = await supabase
          .from("automation_flows")
          .insert(flowData);
        error = err;
      }

      if (error) throw error;
      toast.success("Fluxo salvo com sucesso!");
      onSave();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar fluxo");
    } finally {
      setLoading(false);
    }
  };

  const addNode = (type: string) => {
    let initialData = {};
    if (type === 'message') initialData = { text: "" };
    if (type === 'menu') initialData = { title: "", options: ["Opção 1"] };
    if (type === 'action') initialData = { action: "ai_handover" };
    if (type === 'condition') initialData = { variable: "", operator: "equals", value: "" };
    if (type === 'http_request') initialData = { url: "", method: "GET", body: "", variable_name: "" };

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: type,
      position: { x: 150, y: 150 },
      data: initialData,
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden pointer-events-auto"
      style={{ zIndex: 40, width: '100vw', height: '100vh', left: 0, top: 0 }}
    >
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-900 shrink-0 shadow-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-bold bg-transparent border-none focus:ring-0 p-0 h-auto text-white placeholder:opacity-50"
              placeholder="Nome do fluxo..."
            />
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Editor de Automação</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={saveFlow} 
            disabled={loading} 
            className="gap-2 h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold border-none shadow-lg transition-all active:scale-95"
          >
            <Save className="h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Fluxo"}
          </Button>
        </div>
      </header>

      {/* Editor Area */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
        >
          <Background color="#1e293b" gap={25} size={1} />
          <Controls className="bg-slate-800 border-slate-700 fill-white [&_button]:border-slate-700" />
          
          <Panel position="left" className="ml-6 mt-6">
            <Card className="p-5 space-y-5 w-56 shadow-2xl border-white/10 bg-slate-900/90 backdrop-blur-md text-white">
              <h3 className="font-bold text-[10px] uppercase text-blue-400 mb-2 tracking-[0.2em]">Componentes</h3>
              <div className="grid gap-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 text-xs border-white/5 bg-white/5 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all group"
                  onClick={() => addNode('message')}
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="font-semibold">Mensagem</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 text-xs border-white/5 bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all group"
                  onClick={() => addNode('menu')}
                >
                  <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <List className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="font-semibold">Menu / Lista</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 text-xs border-white/5 bg-white/5 hover:bg-yellow-500/20 hover:border-yellow-500/50 transition-all group"
                  onClick={() => addNode('action')}
                >
                  <div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap className="h-4 w-4 text-yellow-500" />
                  </div>
                  <span className="font-semibold">Ação Sistema</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 text-xs border-white/5 bg-white/5 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all group"
                  onClick={() => addNode('condition')}
                >
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <GitBranch className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="font-semibold">Condição (Se)</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 text-xs border-white/5 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all group"
                  onClick={() => addNode('http_request')}
                >
                  <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe className="h-4 w-4 text-cyan-500" />
                  </div>
                  <span className="font-semibold">Requisição HTTP</span>
                </Button>
              </div>
            </Card>
          </Panel>
        </ReactFlow>
      </div>
    </div>,
    document.body
  );
}
