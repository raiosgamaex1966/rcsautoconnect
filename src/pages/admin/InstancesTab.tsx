import { useState, useEffect, useMemo } from "react";
import { Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStatusBadge } from "./AdminHelpers";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdminInstance {
  id: string; instance_name: string; phone: string; status: string;
  tenant_name: string; user: string; messages24h: number; created_at: string;
}

type SortKey = "phone" | "user" | "status" | "messages24h";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [5, 10, 20];

export default function InstancesTab() {
  const { t } = useLanguage();
  const i = t.admin.instances;
  const statusBadge = useStatusBadge();
  const [instances, setInstances] = useState<AdminInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const fetchInstances = async () => {
    // setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=instances");
      if (error) throw error;
      if (data?.success) setInstances(data.data);
    } catch { toast.error(i.loadError); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-data?action=delete-instance", {
        body: { instance_id: id }
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(i.deletedOk);
        fetchInstances();
      } else {
        throw new Error(data?.error || "Error");
      }
    } catch (error) {
      console.error(error);
      toast.error(i.deleteError);
    }
  };

  useEffect(() => { fetchInstances(); }, []);

  const handleRefresh = async () => { setRefreshing(true); await fetchInstances(); setRefreshing(false); toast.success(i.refreshed); };

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
    let result = instances.filter((inst) => {
      const matchSearch = !search || inst.phone.includes(search) || inst.user.toLowerCase().includes(search.toLowerCase()) || inst.instance_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || inst.status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "phone") cmp = a.phone.localeCompare(b.phone);
        else if (sortKey === "user") cmp = a.user.localeCompare(b.user);
        else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
        else if (sortKey === "messages24h") cmp = a.messages24h - b.messages24h;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [instances, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Silent loading
  // if (loading) return ...;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col lg:flex-row gap-2 sm:gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={i.search} className="pl-9 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{i.all}</SelectItem>
              <SelectItem value="connected">{i.connected}</SelectItem>
              <SelectItem value="disconnected">{i.disconnected}</SelectItem>
              <SelectItem value="error">{i.withError}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="h-9 gap-1.5 w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {i.refresh}
          </Button>
        </div>
      </div>

      <Card>
        <div className="md:hidden divide-y divide-border">
          {paged.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">{i.noInstances}</div>
          ) : (
            paged.map((inst) => (
              <div key={inst.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{inst.instance_name}</p>
                    <p className="font-mono text-xs text-muted-foreground truncate">{inst.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{inst.user}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  {statusBadge(inst.status)}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground mr-1">{i.msgs24h}: {inst.messages24h}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{i.deleteConfirmTitle}</AlertDialogTitle>
                          <AlertDialogDescription>{i.deleteConfirmDesc}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(inst.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.common.confirm}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i.name}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("phone")}><span className="flex items-center">{i.phone} <SortIcon col="phone" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("user")}><span className="flex items-center">{i.user} <SortIcon col="user" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}><span className="flex items-center">{i.status} <SortIcon col="status" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("messages24h")}><span className="flex items-center">{i.msgs24h} <SortIcon col="messages24h" /></span></TableHead>
                <TableHead className="w-[100px] text-right">{t.common.mode}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{i.noInstances}</TableCell></TableRow>
              ) : (
                paged.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="text-sm font-medium">{inst.instance_name}</TableCell>
                    <TableCell className="font-mono text-sm">{inst.phone}</TableCell>
                    <TableCell className="text-sm">{inst.user}</TableCell>
                    <TableCell>{statusBadge(inst.status)}</TableCell>
                    <TableCell className="text-sm">{inst.messages24h}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{i.deleteConfirmTitle}</AlertDialogTitle>
                            <AlertDialogDescription>{i.deleteConfirmDesc}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(inst.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.common.confirm}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{i.showing.replace("{current}", String(paged.length)).replace("{total}", String(filtered.length))}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (<SelectItem key={s} value={String(s)}>{s}{i.perPage}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
