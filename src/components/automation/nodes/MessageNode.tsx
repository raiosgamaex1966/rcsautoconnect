import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function MessageNode({ data, id }: any) {
  const { deleteElements } = useReactFlow();

  return (
    <Card className="w-64 border-2 border-blue-500 shadow-lg overflow-hidden">
      <CardHeader className="p-3 bg-blue-500 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Mensagem</span>
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
      <CardContent className="p-3 bg-card">
        <Textarea 
          placeholder="Digite a mensagem..." 
          className="min-h-[80px] text-sm resize-none bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-blue-500 nodrag nopan mb-3"
          defaultValue={data.text || ""}
          onChange={(e) => {
            data.text = e.target.value;
          }}
        />

        <div className="space-y-3 pt-2 border-t border-border/50 nodrag nopan">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Aguardar resposta</span>
            <input 
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-muted bg-muted"
              defaultChecked={data.wait_for_response || false}
              onChange={(e) => {
                data.wait_for_response = e.target.checked;
                // Force re-render if needed, but React Flow usually handles data changes
              }}
            />
          </div>

          {data.wait_for_response && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Nome da Variável</span>
              <input 
                placeholder="ex: nome_cliente"
                className="w-full h-8 text-xs bg-muted/50 border rounded px-2"
                defaultValue={data.variable_name || ""}
                onChange={(e) => {
                  data.variable_name = e.target.value;
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500 border-2 border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500 border-2 border-white" />
    </Card>
  );
}

