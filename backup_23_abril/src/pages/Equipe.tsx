import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { toast } from "sonner";
import {
  Users, Plus, Trash2, ShieldAlert, ShieldCheck, User,
  Loader2, Mail, Lock, Copy, CheckCircle2, Pencil, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let pass = "";
  for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  return pass;
}

export default function Equipe() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { plan } = usePlanLimits();
  const isFreePlan = plan && plan.price_cents === 0;

  // ───── Estado dos modais ─────
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<any>(null);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);

  // ───── Formulário Adicionar ─────
  const [addForm, setAddForm] = useState({
    fullName: "", email: "", password: generatePassword(), role: "member",
  });
  const [addCopied, setAddCopied] = useState(false);

  // ───── Formulário Editar ─────
  const [editForm, setEditForm] = useState({
    fullName: "", role: "member", newPassword: "", resetPassword: false,
  });
  const [editCopied, setEditCopied] = useState(false);

  // ───── Query: listar membros ─────
  const { data: members, isLoading, isError } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ _action: "team-list" }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao carregar equipe");
      return data.data as any[];
    },
    enabled: !!session?.access_token,
    retry: 1,
  });

  const isTenantAdmin =
    members?.find((m: any) => m.user_id === session?.user?.id)?.role === "admin" ||
    members?.length === 0 ||
    !members;

  // ───── Mutation: adicionar ─────
  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ _action: "team-add", ...payload }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao adicionar membro");
      return data;
    },
    onSuccess: () => {
      toast.success("Membro adicionado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
      setAddModalOpen(false);
      setAddForm({ fullName: "", email: "", password: generatePassword(), role: "member" });
      setAddCopied(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao adicionar membro"),
  });

  // ───── Mutation: editar membro ─────
  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ _action: "team-update-member", ...payload }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao editar membro");
      return data;
    },
    onSuccess: () => {
      toast.success("Membro atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
      setEditModalOpen(false);
      setMemberToEdit(null);
      setEditCopied(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao editar membro"),
  });

  // ───── Mutation: remover ─────
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ _action: "team-remove", user_id: userId }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Erro ao remover membro");
      return data;
    },
    onSuccess: () => {
      toast.success("Membro removido da equipe.");
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
      setRemoveModalOpen(false);
      setMemberToRemove(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover membro"),
  });

  // ───── Handlers ─────
  const openEdit = (member: any) => {
    setMemberToEdit(member);
    setEditForm({ fullName: member.full_name || "", role: member.role || "member", newPassword: "", resetPassword: false });
    setEditCopied(false);
    setEditModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email || !addForm.password) return;
    addMutation.mutate({ email: addForm.email, password: addForm.password, full_name: addForm.fullName, role: addForm.role });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;
    editMutation.mutate({
      user_id: memberToEdit.user_id,
      full_name: editForm.fullName,
      role: editForm.role,
      new_password: editForm.resetPassword ? editForm.newPassword : undefined,
    });
  };

  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    toast.success("Senha copiada! Guarde para enviar ao colaborador.");
    setTimeout(() => setter(false), 3000);
  };

  return (
    <div className="flex-1 space-y-6 max-h-screen overflow-y-auto p-4 md:p-8 pt-6">
      {/* Cabeçalho */}
      <motion.div initial="hidden" animate="visible" variants={fadeIn}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" /> Equipe
          </h2>
          <p className="text-muted-foreground mt-1">Gerencie quem tem acesso ao atendimento</p>
        </div>
        {isTenantAdmin && (
          <Button onClick={() => {
            if (isFreePlan) { toast.info("Para montar a sua equipe, faça o upgrade do plano."); return; }
            setAddModalOpen(true);
          }} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" /> Adicionar Membro
          </Button>
        )}
      </motion.div>

      {/* Tabela */}
      <motion.div initial="hidden" animate="visible" variants={fadeIn}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Nome &amp; E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Entrou em</TableHead>
              {isTenantAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50 mx-auto" />
                  <p>Erro ao carregar membros. Tente atualizar a página.</p>
                </TableCell>
              </TableRow>
            ) : !members || members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-50 mx-auto" />
                  <p>Nenhum membro encontrado</p>
                  <p className="text-sm opacity-70">Você ainda não adicionou nenhum colaborador.</p>
                </TableCell>
              </TableRow>
            ) : (
              members.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{member.full_name}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.role === "admin" ? (
                      <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20 shadow-none">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Administrador
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20 border-zinc-500/20 shadow-none">
                        <User className="h-3 w-3 mr-1" /> Atendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.joined_at ? new Date(member.joined_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  {isTenantAdmin && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(member)}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10" title="Editar membro">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.user_id !== session?.user?.id && (
                          <Button variant="ghost" size="sm"
                            onClick={() => { setMemberToRemove(member); setRemoveModalOpen(true); }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Remover membro">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </motion.div>

      {/* ═══════════ MODAL: ADICIONAR ═══════════ */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Adicionar Colaborador
            </DialogTitle>
            <DialogDescription>Um novo acesso será criado com os dados abaixo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Ex: João Silva" value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="email" className="pl-9" placeholder="joao@empresa.com" value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Senha inicial (gerada automaticamente)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="text" className="pl-9 font-mono bg-muted/50" value={addForm.password} readOnly />
                </div>
                <Button type="button" variant="outline" size="icon"
                  onClick={() => copyText(addForm.password, setAddCopied)} title="Copiar"
                  className={addCopied ? "text-green-500 border-green-500/50" : ""}>
                  {addCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" size="icon" title="Gerar nova senha"
                  onClick={() => { setAddForm(f => ({ ...f, password: generatePassword() })); setAddCopied(false); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Copie e envie ao colaborador. Ele poderá alterá-la depois.</p>
            </div>
            <div className="space-y-2">
              <Label>Permissão</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2"><User className="h-4 w-4" /> Atendente</div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Administrador</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setAddModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar Conta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL: EDITAR ═══════════ */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Editar Membro
            </DialogTitle>
            <DialogDescription>
              Edite os dados de <b>{memberToEdit?.full_name || memberToEdit?.email}</b>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Nome do colaborador" value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required />
              </div>
            </div>
            {/* E-mail (somente leitura) */}
            <div className="space-y-2">
              <Label>E-mail (não pode ser alterado)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 bg-muted/40" value={memberToEdit?.email || ""} readOnly />
              </div>
            </div>
            {/* Cargo */}
            <div className="space-y-2">
              <Label>Permissão / Cargo</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2"><User className="h-4 w-4" /> Atendente</div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-blue-500" /> Administrador</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Redefinir senha */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="resetPass" checked={editForm.resetPassword}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditForm(f => ({ ...f, resetPassword: checked, newPassword: checked ? generatePassword() : "" }));
                    setEditCopied(false);
                  }}
                  className="h-4 w-4 accent-primary cursor-pointer" />
                <Label htmlFor="resetPass" className="cursor-pointer font-medium">Redefinir senha de acesso</Label>
              </div>
              {editForm.resetPassword && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input type="text" className="pl-9 font-mono bg-muted/50" value={editForm.newPassword} readOnly />
                    </div>
                    <Button type="button" variant="outline" size="icon"
                      onClick={() => copyText(editForm.newPassword, setEditCopied)} title="Copiar"
                      className={editCopied ? "text-green-500 border-green-500/50" : ""}>
                      {editCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="icon" title="Gerar nova"
                      onClick={() => { setEditForm(f => ({ ...f, newPassword: generatePassword() })); setEditCopied(false); }}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Copie e envie a nova senha ao colaborador.</p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══════════ MODAL: REMOVER ═══════════ */}
      <Dialog open={removeModalOpen} onOpenChange={setRemoveModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Remover membro?
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <b>{memberToRemove?.full_name}</b>?
              <br /><br />
              Ele perderá acesso imediato e não poderá mais ver conversas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setRemoveModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => memberToRemove && removeMutation.mutate(memberToRemove.user_id)}
              disabled={removeMutation.isPending}>
              {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sim, remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
