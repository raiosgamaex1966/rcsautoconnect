import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GitBranch, MoreVertical, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ConditionNode({ data, id }: any) {
  const { deleteElements } = useReactFlow();

  return (
    <Card className="w-64 border-2 border-purple-500 shadow-lg overflow-hidden">
      <CardHeader className="p-3 bg-purple-500 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Condição (Se)</span>
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
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Variável</p>
            <input 
              placeholder="ex: nome_cliente" 
              className="w-full h-8 text-xs bg-muted/50 border rounded px-2"
              defaultValue={data.variable || ""}
              onChange={(e) => data.variable = e.target.value}
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Operador</p>
            <Select 
              defaultValue={data.operator || "equals"}
              onValueChange={(val) => data.operator = val}
            >
              <SelectTrigger className="h-8 text-xs bg-muted/50 border-none">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Igual a</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="not_equals">Diferente de</SelectItem>
                <SelectItem value="greater_than">Maior que</SelectItem>
                <SelectItem value="less_than">Menor que</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Valor</p>
            <input 
              placeholder="Valor para comparar..." 
              className="w-full h-8 text-xs bg-muted/50 border rounded px-2"
              defaultValue={data.value || ""}
              onChange={(e) => data.value = e.target.value}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground pt-2">
            <div className="flex items-center gap-1 text-green-600">VERDADEIRO</div>
            <div className="flex items-center gap-1 text-red-600">FALSO</div>
        </div>
      </CardContent>
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white" />
      
      {/* Verdadeiro Handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="true"
        style={{ left: '25%' }}
        className="w-3 h-3 bg-green-500 border-2 border-white" 
      />
      
      {/* Falso Handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="false"
        style={{ left: '75%' }}
        className="w-3 h-3 bg-red-500 border-2 border-white" 
      />
    </Card>
  );
}
