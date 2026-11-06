import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap, User, Tags, Bot, MoreVertical, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ActionNode({ data, id }: any) {
  const { deleteElements } = useReactFlow();

  return (
    <Card className="w-64 border-2 border-yellow-500 shadow-lg overflow-hidden">
      <CardHeader className="p-3 bg-yellow-500 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Ação do Sistema</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              className="text-destructive gap-2"
              onClick={() => deleteElements({ nodes: [{ id }] })}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Nó
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-3 bg-card space-y-4">
        <div className="nodrag nopan">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Tipo de Ação</p>
          <Select 
            defaultValue={data.action || "ai_handover"}
            onValueChange={(val) => data.action = val}
          >
            <SelectTrigger className="h-9 text-xs bg-muted/50 border-none">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai_handover">
                <div className="flex items-center gap-2">
                  <Bot className="h-3 w-3 text-primary" />
                  <span>Passar para IA</span>
                </div>
              </SelectItem>
              <SelectItem value="human_transfer">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-orange-500" />
                  <span>Chamar Humano</span>
                </div>
              </SelectItem>
              <SelectItem value="add_tag">
                <div className="flex items-center gap-2">
                  <Tags className="h-3 w-3 text-green-500" />
                  <span>Adicionar Tag</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {data.action === 'add_tag' && (
          <input 
            placeholder="Nome da tag..." 
            className="w-full h-8 text-xs bg-muted/50 border rounded px-2 nodrag nopan"
            defaultValue={data.tag_name || ""}
            onChange={(e) => data.tag_name = e.target.value}
          />
        )}

        <div className="p-2 rounded bg-yellow-50 text-[10px] text-yellow-700 leading-tight">
          💡 Esta ação interrompe o fluxo e executa a operação selecionada.
        </div>
      </CardContent>
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-yellow-500 border-2 border-white" />
    </Card>
  );
}
