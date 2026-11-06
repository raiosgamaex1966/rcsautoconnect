import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { List, Plus, Trash2, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export function MenuNode({ data, id }: any) {
  const [options, setOptions] = useState(data.options || ["Opção 1"]);
  const { deleteElements } = useReactFlow();

  const addOption = () => {
    const newOptions = [...options, `Opção ${options.length + 1}`];
    setOptions(newOptions);
    data.options = newOptions;
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_: any, i: number) => i !== index);
    setOptions(newOptions);
    data.options = newOptions;
  };

  const updateOption = (index: number, val: string) => {
    const newOptions = [...options];
    newOptions[index] = val;
    setOptions(newOptions);
    data.options = newOptions;
  };

  return (
    <Card className="w-72 border-2 border-purple-500 shadow-lg relative">

      <CardHeader className="p-3 bg-purple-500 text-white flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Menu / Lista</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={addOption}>
            <Plus className="h-4 w-4" />
          </Button>
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
        </div>
      </CardHeader>
      <CardContent className="p-3 bg-card space-y-2">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pergunta/Título</p>
        <Input 
          placeholder="Ex: Escolha uma opção..." 
          className="h-8 text-sm bg-muted/30 border-none nodrag nopan"
          defaultValue={data.title || ""}
          onChange={(e) => data.title = e.target.value}
        />
        
        <div className="space-y-1 mt-3">
          {options.map((opt: string, idx: number) => (
            <div key={idx} className="relative flex items-center gap-1 group h-8">
              <span className="text-[10px] font-bold w-4 text-purple-500">{idx + 1}</span>
              <Input 
                value={opt} 
                onChange={(e) => updateOption(idx, e.target.value)}
                className="h-8 text-xs bg-muted/50 border-none pr-8 nodrag nopan"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 absolute right-1 opacity-0 group-hover:opacity-100"
                onClick={() => removeOption(idx)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
              
              {/* Output handle for each option - Positioned on the right edge of the option row */}
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`option-${idx}`}
                className="w-3 h-3 bg-purple-500 border-2 border-white"
                style={{ right: '-12px', zIndex: 50 }} 
              />
            </div>
          ))}
        </div>
      </CardContent>
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500 border-2 border-white" style={{ zIndex: 50 }} />
    </Card>
  );
}


