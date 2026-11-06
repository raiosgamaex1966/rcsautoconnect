import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Globe, MoreVertical, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function HttpNode({ data, id }: any) {
  const { deleteElements } = useReactFlow();

  return (
    <Card className="w-64 border-2 border-emerald-500 shadow-lg overflow-hidden">
      <CardHeader className="p-3 bg-emerald-500 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Requisição HTTP</span>
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
      <CardContent className="p-3 bg-card space-y-3">
        <div className="nodrag nopan space-y-2">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Método & URL</p>
            <div className="flex gap-1">
              <Select 
                defaultValue={data.method || "GET"}
                onValueChange={(val) => data.method = val}
              >
                <SelectTrigger className="h-8 w-20 text-[10px] bg-muted/50 border-none shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
              <input 
                placeholder="https://api.exemplo.com/..." 
                className="flex-1 h-8 text-[10px] bg-muted/50 border rounded px-2"
                defaultValue={data.url || ""}
                onChange={(e) => data.url = e.target.value}
              />
            </div>
          </div>

          {data.method === 'POST' && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Body (JSON)</p>
              <Textarea 
                placeholder='{"key": "value"}' 
                className="min-h-[60px] text-[10px] bg-muted/50 border-none resize-none"
                defaultValue={data.body || ""}
                onChange={(e) => data.body = e.target.value}
              />
            </div>
          )}

          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Salvar Resposta em</p>
            <input 
              placeholder="ex: resultado_api" 
              className="w-full h-8 text-xs bg-muted/50 border rounded px-2"
              defaultValue={data.variable_name || ""}
              onChange={(e) => data.variable_name = e.target.value}
            />
          </div>
        </div>

        <div className="p-2 rounded bg-emerald-50 text-[10px] text-emerald-700 leading-tight">
          💡 Use `{{variavel}}` na URL ou no Body para enviar dados dinâmicos.
        </div>
      </CardContent>
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-500 border-2 border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-500 border-2 border-white" />
    </Card>
  );
}
