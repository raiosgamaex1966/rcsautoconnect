import { useState, useRef, useEffect } from "react";
import {
  Search, Plus, Phone, Mail, Tag, Pencil, Trash2, Loader2,
  Users, X, MessageCircle, Upload, FileSpreadsheet, Download,
  LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContacts, type Contact } from "@/hooks/useContacts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import ImportFromInstanceDialog from "@/components/contacts/ImportFromInstanceDialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function ContactForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: Partial<Contact>;
  onSubmit: (data: { name: string; phone: string; email: string; tags: string[]; notes: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [tagsInput, setTagsInput] = useState((initial?.tags || []).join(", "));
  const [notes, setNotes] = useState(initial?.notes || "");

  const handleSubmit = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), tags, notes: notes.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="João Silva" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone *</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">E-mail</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@email.com" className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tags (separadas por vírgula)</Label>
        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="cliente, vip, lead" className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notas</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre o contato..." rows={3} className="text-sm" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {initial?.id ? "Salvar" : "Criar contato"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function parseCSV(text: string): { name: string; phone: string; email?: string; tags?: string[] }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const nameIdx = header.findIndex((h) => ["nome", "name"].includes(h));
  const phoneIdx = header.findIndex((h) => ["telefone", "phone", "celular", "whatsapp"].includes(h));
  const emailIdx = header.findIndex((h) => ["email", "e-mail"].includes(h));
  const tagsIdx = header.findIndex((h) => ["tags", "tag", "etiquetas"].includes(h));

  if (nameIdx === -1 || phoneIdx === -1) return [];

  const rows: { name: string; phone: string; email?: string; tags?: string[] }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const name = cols[nameIdx]?.trim();
    const phone = cols[phoneIdx]?.trim();
    if (!name || !phone) continue;
    rows.push({
      name,
      phone,
      email: emailIdx !== -1 ? cols[emailIdx]?.trim() || undefined : undefined,
      tags: tagsIdx !== -1 && cols[tagsIdx] ? cols[tagsIdx].split("|").map((t) => t.trim()).filter(Boolean) : undefined,
    });
  }
  return rows;
}

export default function Contatos() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { contacts, loading, createContact, updateContact, deleteContact, bulkCreate, getConversationForContact, startConversation } = useContacts();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [sortField, setSortField] = useState<"name" | "phone" | "email" | "created_at">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const PAGE_SIZE = viewMode === "table" ? 15 : 12;

  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp instance import state
  const [showInstanceImport, setShowInstanceImport] = useState(false);

  // Start conversation state
  const [startConvContactId, setStartConvContactId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [instances, setInstances] = useState<{ id: string; instance_name: string; status: string }[]>([]);
  const [startingConv, setStartingConv] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("data-api", {
      body: { _action: "whatsapp-instances-list-brief" },
    }).then(({ data }) => {
      if (data?.success) setInstances(data.data || []);
    });
  }, []);

  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags || [])));

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesTag = !tagFilter || (c.tags || []).includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let valA = "", valB = "";
    if (sortField === "name") { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); }
    else if (sortField === "phone") { valA = a.phone; valB = b.phone; }
    else if (sortField === "email") { valA = (a.email || "").toLowerCase(); valB = (b.email || "").toLowerCase(); }
    else if (sortField === "created_at") { valA = a.created_at; valB = b.created_at; }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContacts = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleTagFilter = (tag: string | null) => { setTagFilter(tag); setCurrentPage(1); };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleCreate = async (data: { name: string; phone: string; email: string; tags: string[]; notes: string }) => {
    setSaving(true);
    const result = await createContact(data);
    if (result.error) toast.error(result.error);
    else { toast.success("Contato criado!"); setShowCreate(false); }
    setSaving(false);
  };

  const handleUpdate = async (data: { name: string; phone: string; email: string; tags: string[]; notes: string }) => {
    if (!editContact) return;
    setSaving(true);
    const result = await updateContact(editContact.id, data);
    if (result.error) toast.error(result.error);
    else { toast.success("Contato atualizado!"); setEditContact(null); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteContact(deleteId);
    if (result.error) toast.error(result.error);
    else toast.success("Contato excluído!");
    setDeleteId(null);
  };

  const handleImportCSV = async () => {
    if (!csvFile) return;
    setImporting(true);
    setImportProgress(null);
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error("Arquivo CSV inválido. Certifique-se de ter colunas 'nome' e 'telefone'.");
        setImporting(false);
        return;
      }
      const result = await bulkCreate(rows, (current, total) => {
        setImportProgress({ current, total });
      });
      if (result.error) {
        toast.error(`Erro: ${result.error}. ${result.imported} importados.`);
      } else {
        toast.success(`${result.imported} contatos importados!`);
        setShowImport(false);
        setCsvFile(null);
      }
    } catch {
      toast.error("Erro ao processar o arquivo CSV");
    }
    setImporting(false);
    setImportProgress(null);
  };

  const handleOpenConversation = async (contactId: string) => {
    const convId = await getConversationForContact(contactId);
    if (convId) {
      navigate(`/conversas?id=${convId}`);
    } else {
      // No conversation found — prompt to start one
      setStartConvContactId(contactId);
      setSelectedInstanceId("");
    }
  };

  const handleStartConversation = async () => {
    if (!startConvContactId || !selectedInstanceId) return;
    setStartingConv(true);
    const result = await startConversation(startConvContactId, selectedInstanceId);
    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      toast.success("Conversa iniciada!");
      setStartConvContactId(null);
      navigate(`/conversas?id=${result.id}`);
    }
    setStartingConv(false);
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.info("Nenhum contato para exportar");
      return;
    }
    const header = "nome;telefone;email;tags;notas";
    const rows = contacts.map((c) => {
      const escape = (v: string) => v.includes(";") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
      return [
        escape(c.name),
        escape(c.phone),
        escape(c.email || ""),
        escape((c.tags || []).join("|")),
        escape((c.notes || "").replace(/\n/g, " ")),
      ].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${contacts.length} contatos exportados!`);
  };



  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t.contacts.title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t.contacts.contactCount.replace("{count}", String(contacts.length))}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} className="text-xs sm:text-sm">
            <Download className="h-4 w-4 mr-1" /> {t.contacts.export}
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)} className="text-xs sm:text-sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> {t.contacts.importCsv}
          </Button>
          <Button variant="outline" onClick={() => setShowInstanceImport(true)} className="text-xs sm:text-sm">
            <MessageCircle className="h-4 w-4 mr-1" /> {t.contacts.importFromInstance}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="text-xs sm:text-sm">
            <Plus className="h-4 w-4 mr-1" /> {t.contacts.newContact}
          </Button>
        </div>
      </div>

      {/* Search + tags */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t.contacts.searchPlaceholder} className="pl-9" value={search} onChange={(e) => handleSearch(e.target.value)} />
          </div>
          <div className="flex border rounded-md overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              title="Cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              title="Tabela"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => handleTagFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !tagFilter ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.contacts.all}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagFilter(tagFilter === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  tagFilter === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="h-2.5 w-2.5 inline mr-1" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contact list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">{t.contacts.noContacts}</p>
          <p className="text-xs">{contacts.length === 0 ? t.contacts.createFirst : t.contacts.tryAnother}</p>
        </div>
      ) : (
        <>
          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedContacts.map((contact) => (
                <Card key={contact.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{contact.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {contact.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver conversa" onClick={() => handleOpenConversation(contact.id)}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditContact(contact)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(contact.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {contact.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {contact.email}
                      </p>
                    )}

                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {contact.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{contact.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("name")}>
                      <span className="inline-flex items-center">{t.contacts.name}<SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort("phone")}>
                      <span className="inline-flex items-center">{t.contacts.phone}<SortIcon field="phone" /></span>
                    </TableHead>
                    <TableHead className="text-xs hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort("email")}>
                      <span className="inline-flex items-center">{t.contacts.email}<SortIcon field="email" /></span>
                    </TableHead>
                    <TableHead className="text-xs hidden md:table-cell">{t.contacts.tags}</TableHead>
                    <TableHead className="text-xs text-right w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-accent/50">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[150px]">{contact.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">{contact.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2 hidden sm:table-cell">{contact.email || "—"}</TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {(contact.tags || []).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenConversation(contact.id)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditContact(contact)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(contact.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(safePage - 1)}
                >
                  ←
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="px-1 text-xs text-muted-foreground self-center">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === safePage ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 text-xs p-0"
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(safePage + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">{t.contacts.newContactTitle}</DialogTitle>
          </DialogHeader>
          <ContactForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">{t.contacts.editContactTitle}</DialogTitle>
          </DialogHeader>
          {editContact && (
            <ContactForm initial={editContact} onSubmit={handleUpdate} onCancel={() => setEditContact(null)} saving={saving} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.contacts.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.contacts.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { if (!importing) { setShowImport(open); setCsvFile(null); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <FileSpreadsheet className="h-5 w-5" /> Importar Contatos via CSV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary p-3 text-xs space-y-1">
              <p className="font-medium">Formato esperado do CSV:</p>
              <p className="text-muted-foreground">Colunas obrigatórias: <strong>nome</strong>, <strong>telefone</strong></p>
              <p className="text-muted-foreground">Colunas opcionais: <strong>email</strong>, <strong>tags</strong> (separadas por |)</p>
              <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">nome;telefone;email;tags<br />João;5511999999999;joao@email.com;cliente|vip</p>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${csvFile ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
              onClick={() => csvInputRef.current?.click()}
            >
              <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCsvFile(f); }} />
              {csvFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[200px]">{csvFile.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo CSV</p>
                </>
              )}
            </div>

            {importProgress && (
              <div className="space-y-1">
                <Progress value={(importProgress.current / importProgress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  {importProgress.current} de {importProgress.total} contatos importados
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowImport(false); setCsvFile(null); }} disabled={importing}>Cancelar</Button>
              <Button onClick={handleImportCSV} disabled={!csvFile || importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Importar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Instance Import dialog */}
      <ImportFromInstanceDialog
        open={showInstanceImport}
        onOpenChange={setShowInstanceImport}
        existingPhones={contacts.map((c) => c.phone)}
        onImport={async (rows, onProgress) => bulkCreate(rows, onProgress)}
      />

      {/* Start Conversation Dialog */}
      <Dialog open={!!startConvContactId} onOpenChange={(open) => { if (!open) setStartConvContactId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Iniciar Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione a instância WhatsApp para iniciar a conversa com{" "}
              <span className="font-medium text-foreground">
                {contacts.find((c) => c.id === startConvContactId)?.name}
              </span>
            </p>
            {instances.filter((i) => i.status === "connected").length === 0 ? (
              <p className="text-sm text-destructive">Nenhuma instância conectada. Conecte uma instância primeiro.</p>
            ) : (
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.filter((i) => i.status === "connected").map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartConvContactId(null)}>Cancelar</Button>
              <Button onClick={handleStartConversation} disabled={!selectedInstanceId || startingConv}>
                {startingConv ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MessageCircle className="h-4 w-4 mr-1" />}
                Iniciar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
