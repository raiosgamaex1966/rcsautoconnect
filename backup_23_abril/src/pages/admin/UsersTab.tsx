import { useState, useEffect, useMemo } from "react";
import { Search, Download, MoreHorizontal, UserCheck, UserX, Ban, Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, Shield, ShieldOff, Mail, Phone, Building2, Calendar, Clock, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStatusBadge } from "./AdminHelpers";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  instances: number;
  messages: number;
  lastActive: string;
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  bio: string;
  avatar_url: string;
  tenant_id: string;
  tenant_name: string;
  created_at: string;
  last_sign_in: string;
  email_confirmed: boolean;
  roles: string[];
  tenant_role: string;
  subscription: {
    status: string;
    started_at: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    plan: { name: string; price_cents: number } | null;
  } | null;
}

type SortKey = "name" | "plan" | "status" | "instances" | "messages";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UsersTab() {
  const { t } = useLanguage();
  const u = t.admin.users;
  const statusBadge = useStatusBadge();
  const [users, setUsers] = useState<AdminUser[]>(() => {
    const cached = localStorage.getItem("rcs_admin_users");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [detailUser, setDetailUser] = useState<UserDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [allPlans, setAllPlans] = useState<{ id: string; name: string; price_cents: number }[]>([]);
  const [planChanging, setPlanChanging] = useState(false);

  const formatLastActive = (dateStr: string): string => {
    if (!dateStr) return u.never;
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return u.now;
    if (mins < 60) return u.minAgo.replace("{count}", String(mins));
    const hours = Math.floor(mins / 60);
    if (hours < 24) return u.hoursAgo.replace("{count}", String(hours));
    const days = Math.floor(hours / 24);
    return u.daysAgo.replace("{count}", String(days));
  };

  const fetchUsers = async () => {
    // setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=users");
      if (error) {
        console.error("Function invoke error:", error);
        throw error;
      }
      if (data?.success) {
        const udata = data.data.map((usr: any) => ({
          ...usr,
          lastActive: formatLastActive(usr.lastActive),
        }));
        setUsers(udata);
        localStorage.setItem("rcs_admin_users", JSON.stringify(udata));
      } else {
        console.error("Admin data error response:", data?.error);
        throw new Error(data?.error || "Unknown error");
      }
    } catch (e) {
      console.error("Error fetching users:", e);
      toast.error(u.loadError);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    supabase.functions.invoke("admin-data", { method: "POST", body: { _action: "list-plans-brief" } }).then(({ data }) => {
      if (data?.success && data.data) setAllPlans(data.data);
    });
  }, []);

  const handleChangePlan = async (planId: string) => {
    if (!detailUser) return;
    setPlanChanging(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=change-user-plan", {
        body: { user_id: detailUser.id, plan_id: planId },
      });
      if (error || !data?.success) throw new Error(data?.error || "Failed");
      toast.success(u.planChanged);
      fetchUserDetails(detailUser.id);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || u.planChangeError);
    }
    setPlanChanging(false);
  };

  const fetchUserDetails = async (userId: string) => {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const { data, error } = await supabase.functions.invoke(`admin-data?action=get-user-details&user_id=${userId}`);
      if (error) throw error;
      if (data?.success) setDetailUser(data.data);
    } catch (e) {
      console.error("Error fetching user details:", e);
      toast.error(u.detailsError);
      setShowDetail(false);
    }
    setDetailLoading(false);
  };

  const handleRoleToggle = async (role: string, currentlyHas: boolean) => {
    if (!detailUser) return;
    setRoleUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=update-user-role", {
        body: { user_id: detailUser.id, role, action: currentlyHas ? "remove" : "add" },
      });
      if (error || !data?.success) throw new Error(data?.error || "Failed");
      toast.success(currentlyHas ? u.roleRemoved.replace("{role}", role) : u.roleAdded.replace("{role}", role));
      setDetailUser((prev) => {
        if (!prev) return prev;
        const newRoles = currentlyHas ? prev.roles.filter((r) => r !== role) : [...prev.roles, role];
        return { ...prev, roles: newRoles };
      });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || u.roleUpdateError);
    }
    setRoleUpdating(false);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    let result = users.filter((usr) => {
      const matchSearch = !search || usr.name.toLowerCase().includes(search.toLowerCase()) || usr.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || usr.status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = a.name.localeCompare(b.name);
        else if (sortKey === "plan") cmp = a.plan.localeCompare(b.plan);
        else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
        else if (sortKey === "instances") cmp = a.instances - b.instances;
        else if (sortKey === "messages") cmp = a.messages - b.messages;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [users, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSuspend = async (usr: AdminUser) => {
    const newStatus = usr.status === "suspended" ? "active" : "suspended";
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=update-user-status", {
        body: { user_id: usr.id, status: newStatus },
      });
      if (error || !data?.success) throw new Error("Failed");
      toast.success(newStatus === "suspended" ? u.suspended_msg.replace("{name}", usr.name) : u.reactivated.replace("{name}", usr.name));
      fetchUsers();
    } catch {
      toast.error(u.statusError);
    }
  };

  const handleDelete = async (usr: AdminUser) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=delete-user", {
        body: { user_id: usr.id },
      });
      if (error || !data?.success) throw new Error(data?.error || "Failed");
      toast.success(u.removedOk.replace("{name}", usr.name));
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || u.removeError);
    }
  };

  const handleExport = () => {
    const csv = [
      `${u.user},Email,${u.plan},Status,${u.instances},${u.messages}`,
      ...filtered.map((usr) => `${usr.name},${usr.email},${usr.plan},${usr.status},${usr.instances},${usr.messages}`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(u.csvExported);
  };

  const UserActions = ({ user: usr }: { user: AdminUser }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => fetchUserDetails(usr.id)}>
          <Eye className="h-4 w-4 mr-2" /> {u.viewDetails}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSuspend(usr)}>
          {usr.status === "suspended" ? <UserCheck className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
          {usr.status === "suspended" ? u.reactivate : u.suspend}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(usr)}>
          <UserX className="h-4 w-4 mr-2" /> {u.remove}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Silent loading
  // if (loading) { ... }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={u.search} className="pl-9 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{u.all}</SelectItem>
              <SelectItem value="active">{u.active}</SelectItem>
              <SelectItem value="trial">{u.trial}</SelectItem>
              <SelectItem value="suspended">{u.suspended}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="h-9 gap-1.5 w-full sm:w-auto">
            <Download className="h-4 w-4" /> {u.export}
          </Button>
        </div>
      </div>

      <Card>
        <div className="md:hidden divide-y divide-border">
          {paged.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">{u.noUsers}</div>
          ) : (
            paged.map((usr) => (
              <div key={usr.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{usr.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{usr.email}</p>
                  </div>
                  <UserActions user={usr} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Badge variant="outline">{usr.plan}</Badge>
                  {statusBadge(usr.status)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <span>{u.instances}: {usr.instances}</span>
                  <span>Msgs: {usr.messages.toLocaleString()}</span>
                  <span className="truncate">{usr.lastActive}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  <span className="flex items-center">{u.user} <SortIcon col="name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("plan")}>
                  <span className="flex items-center">{u.plan} <SortIcon col="plan" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                  <span className="flex items-center">Status <SortIcon col="status" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("instances")}>
                  <span className="flex items-center">{u.instances} <SortIcon col="instances" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("messages")}>
                  <span className="flex items-center">{u.messages} <SortIcon col="messages" /></span>
                </TableHead>
                <TableHead className="hidden lg:table-cell">{u.lastAccess}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">{u.noUsers}</TableCell>
                </TableRow>
              ) : (
                paged.map((usr) => (
                  <TableRow key={usr.id} className="cursor-pointer" onClick={() => fetchUserDetails(usr.id)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{usr.name}</p>
                        <p className="text-xs text-muted-foreground">{usr.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{usr.plan}</Badge></TableCell>
                    <TableCell>{statusBadge(usr.status)}</TableCell>
                    <TableCell>{usr.instances}</TableCell>
                    <TableCell>{usr.messages.toLocaleString()}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{usr.lastActive}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}><UserActions user={usr} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{u.showing.replace("{current}", String(paged.length)).replace("{total}", String(filtered.length))}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}{u.perPage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {u.userDetails}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : detailUser ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{detailUser.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{detailUser.email}</span>
                    {detailUser.email_confirmed && <Badge variant="outline" className="text-[10px] shrink-0">{u.verified}</Badge>}
                  </div>
                  {detailUser.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{detailUser.phone}</span>
                    </div>
                  )}
                  {detailUser.company && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{detailUser.company}</span>
                    </div>
                  )}
                  {detailUser.tenant_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 shrink-0" />
                      <span>Tenant: {detailUser.tenant_name}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {u.created}: {formatDate(detailUser.created_at)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {u.lastLogin}: {formatDate(detailUser.last_sign_in)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> {u.planSubscription}
                </h4>
                {detailUser.subscription && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{(detailUser.subscription.plan as any)?.name || "—"}</Badge>
                    {statusBadge(detailUser.subscription.status)}
                    {detailUser.subscription.trial_ends_at && (
                      <span className="text-xs text-muted-foreground">Trial: {formatDate(detailUser.subscription.trial_ends_at)}</span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground shrink-0">{u.changePlan}</Label>
                  <Select
                    value={undefined}
                    onValueChange={handleChangePlan}
                    disabled={planChanging}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder={(detailUser.subscription?.plan as any)?.name || u.selectPlan} />
                    </SelectTrigger>
                    <SelectContent>
                      {allPlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — R$ {(p.price_cents / 100).toFixed(2).replace(".", ",")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {planChanging && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              </div>
              <Separator />

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">{u.manageRoles}</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <div>
                        <Label className="text-sm font-medium">{u.adminRole}</Label>
                        <p className="text-xs text-muted-foreground">{u.adminRoleDesc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={detailUser.roles.includes("admin")}
                      onCheckedChange={() => handleRoleToggle("admin", detailUser.roles.includes("admin"))}
                      disabled={roleUpdating}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <ShieldOff className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm font-medium">{u.memberRole}</Label>
                        <p className="text-xs text-muted-foreground">{u.memberRoleDesc}</p>
                      </div>
                    </div>
                    <Switch
                      checked={detailUser.roles.includes("member")}
                      onCheckedChange={() => handleRoleToggle("member", detailUser.roles.includes("member"))}
                      disabled={roleUpdating}
                    />
                  </div>
                </div>
                {detailUser.tenant_role && (
                  <p className="text-xs text-muted-foreground">{u.tenantRole}: <Badge variant="outline" className="text-[10px]">{detailUser.tenant_role}</Badge></p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
