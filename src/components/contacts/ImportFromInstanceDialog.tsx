import { useState, useEffect, useMemo } from "react";
import { Loader2, MessageCircle, Search, CheckSquare, Square, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppInstances, type WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface EvoContact {
  name: string;
  phone: string;
  profilePicUrl: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPhones: string[];
  onImport: (contacts: { name: string; phone: string }[], onProgress?: (current: number, total: number) => void) => Promise<{ error?: string; imported: number }>;
}

export default function ImportFromInstanceDialog({ open, onOpenChange, existingPhones, onImport }: Props) {
  const { t } = useLanguage();
  const { instances } = useWhatsAppInstances();
  const connectedInstances = instances.filter((i) => i.status === "connected");

  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [evoContacts, setEvoContacts] = useState<EvoContact[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const existingSet = useMemo(() => new Set(existingPhones), [existingPhones]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedInstance("");
      setEvoContacts([]);
      setFetched(false);
      setSelected(new Set());
      setSearch("");
      setImporting(false);
      setImportProgress(null);
    }
  }, [open]);

  const handleFetch = async () => {
    if (!selectedInstance) return;
    setFetching(true);
    setFetched(false);
    setEvoContacts([]);
    setSelected(new Set());

    const { data, error } = await supabase.functions.invoke("whatsapp-instances", {
      body: { _action: "find-contacts", instance_id: selectedInstance },
    });

    if (error || !data?.success) {
      toast.error(data?.error || "Erro ao buscar contatos");
      setFetching(false);
      return;
    }

    const contacts: EvoContact[] = data.data || [];
    setEvoContacts(contacts);
    // Pre-select contacts that don't already exist
    const newSet = new Set<string>();
    contacts.forEach((c) => {
      if (!existingSet.has(c.phone)) newSet.add(c.phone);
    });
    setSelected(newSet);
    setFetched(true);
    setFetching(false);
  };

  const filtered = evoContacts.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const newContacts = filtered.filter((c) => !existingSet.has(c.phone));
  const allNewSelected = newContacts.length > 0 && newContacts.every((c) => selected.has(c.phone));

  const toggleAll = () => {
    if (allNewSelected) {
      setSelected(new Set());
    } else {
      const s = new Set<string>();
      newContacts.forEach((c) => s.add(c.phone));
      setSelected(s);
    }
  };

  const toggleOne = (phone: string) => {
    const s = new Set(selected);
    if (s.has(phone)) s.delete(phone);
    else s.add(phone);
    setSelected(s);
  };

  const handleImport = async () => {
    const toImport = evoContacts.filter((c) => selected.has(c.phone));
    if (toImport.length === 0) return;

    setImporting(true);
    setImportProgress(null);

    const result = await onImport(
      toImport.map((c) => ({ name: c.name, phone: c.phone })),
      (current, total) => setImportProgress({ current, total }),
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t.contacts.importedFromWhatsapp.replace("{count}", String(result.imported)));
      onOpenChange(false);
    }
    setImporting(false);
    setImportProgress(null);
  };

  const ct = t.contacts;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) onOpenChange(v); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg">
            <MessageCircle className="h-5 w-5" /> {ct.importFromInstanceTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Instance selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium">{ct.selectInstance}</label>
            {connectedInstances.length === 0 ? (
              <p className="text-xs text-muted-foreground">{ct.noConnectedInstances}</p>
            ) : (
              <div className="flex gap-2">
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={ct.selectInstancePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.instance_name} {inst.phone ? `(${inst.phone})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleFetch} disabled={!selectedInstance || fetching}>
                  {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : ct.fetchContacts}
                </Button>
              </div>
            )}
          </div>

          {/* Contacts list */}
          {fetched && (
            <>
              {evoContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{ct.noContactsFound}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {ct.foundContacts.replace("{count}", String(evoContacts.length))}
                    </p>
                    <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                      {allNewSelected ? ct.deselectAll : ct.selectAll}
                    </Button>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={ct.searchPlaceholder}
                      className="pl-9 h-8 text-xs"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <ScrollArea className="flex-1 min-h-0 max-h-[40vh] border rounded-md">
                    <div className="divide-y">
                      {filtered.map((c) => {
                        const exists = existingSet.has(c.phone);
                        return (
                          <label
                            key={c.phone}
                            className={`flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer text-sm ${exists ? "opacity-50" : ""}`}
                          >
                            <Checkbox
                              checked={selected.has(c.phone)}
                              disabled={exists}
                              onCheckedChange={() => toggleOne(c.phone)}
                            />
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                            </div>
                            {exists && (
                              <Badge variant="outline" className="text-[10px] shrink-0">{ct.alreadyExists}</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </>
          )}

          {fetching && (
            <div className="flex flex-col items-center py-8 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{ct.fetchingContacts}</p>
            </div>
          )}

          {importProgress && (
            <div className="space-y-1">
              <Progress value={(importProgress.current / importProgress.total) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                {importProgress.current} / {importProgress.total}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t.common.cancel}
          </Button>
          {fetched && evoContacts.length > 0 && (
            <Button onClick={handleImport} disabled={selected.size === 0 || importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {ct.importSelected} ({selected.size})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
