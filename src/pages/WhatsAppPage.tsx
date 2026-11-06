import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone, Wifi, WifiOff, QrCode, RefreshCw, Trash2, Plus,
  MessageSquare, CheckCircle, Loader2, AlertTriangle, Settings2, Settings,
  Phone, Instagram
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InstanceSettingsModal from "@/components/whatsapp/InstanceSettingsModal";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWhatsAppInstances, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function WhatsApp() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { instances, loading, hasFetched, fetchInstances, createInstance, connectInstance, disconnectInstance, deleteInstance, checkInstanceStatus, setWebhook } = useWhatsAppInstances();
  const { plan, usage, hasPlan, trialBlocked, isAdmin, canCreateInstance, loading: planLimitsLoading, refetch: refetchPlanLimits } = usePlanLimits();
  const instanceLimitReached = !isAdmin && hasPlan && !!plan && !!usage && usage.instances >= plan.max_instances;
  const [showNewModal, setShowNewModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState<WhatsAppInstance | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<WhatsAppInstance | null>(null);
  const [newName, setNewName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"whatsapp" | "instagram">("whatsapp");
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [instaUsername, setInstaUsername] = useState("");
  const [instaPassword, setInstaPassword] = useState("");
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Confirmation dialogs
  const [confirmDisconnect, setConfirmDisconnect] = useState<WhatsAppInstance | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppInstance | null>(null);
  const [settingsInstance, setSettingsInstance] = useState<WhatsAppInstance | null>(null);

  // Polling: check status every 5s while connect modal is open
  useEffect(() => {
    if (showConnectModal && showConnectModal.status !== "connected") {
      setPolling(true);
      pollingRef.current = setInterval(async () => {
        const result = await checkInstanceStatus(showConnectModal.id);
        if (result?.status === "connected") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPolling(false);
          setShowConnectModal(null);
          setQrData(null);
          setShowSuccessModal(showConnectModal);
          await fetchInstances();
        }
      }, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setPolling(false);
    };
  }, [showConnectModal, checkInstanceStatus, fetchInstances]);

  const connected = instances.filter((i) => i.status === "connected").length;
  const disconnected = instances.filter((i) => i.status !== "connected").length;

  const handleCreate = async () => {
    if (!newName.trim() || trialBlocked) return;
    setCreating(true);
    const result = await createInstance(newName.trim(), newChannelType);
    setCreating(false);
    if (result) {
      await refetchPlanLimits();
      setNewName("");
      setShowNewModal(false);
      if (result.qr_code) {
        setQrData(result.qr_code);
        setShowConnectModal(result);
      }
    }
  };

  const handleConnect = async (inst: WhatsAppInstance) => {
    setCreating(true);
    const result = await connectInstance(inst.id, instaUsername, instaPassword);
    setCreating(false);
    if (result?.qr_code) {
      setQrData(result.qr_code);
    } else if (inst.channel_type === "instagram") {
      toast.success("Solicitação de login enviada. Aguarde a conexão...");
    }
  };

  const handleDisconnect = async (inst: WhatsAppInstance) => {
    setConfirmDisconnect(null);
    await disconnectInstance(inst.id);
  };

  const handleDelete = async (inst: WhatsAppInstance) => {
    setConfirmDelete(null);
    await deleteInstance(inst.id);
  };

  const handleReconnect = async (inst: WhatsAppInstance) => {
    setQrData(null);
    setShowConnectModal(inst);
    const result = await connectInstance(inst.id);
    if (result?.qr_code) {
      setQrData(result.qr_code);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string; icon: typeof Wifi }> = {
      connected: { variant: "default", label: t.whatsapp.statusConnected, icon: Wifi },
      disconnected: { variant: "secondary", label: t.whatsapp.statusDisconnected, icon: WifiOff },
      connecting: { variant: "outline", label: t.whatsapp.statusConnecting, icon: RefreshCw },
      error: { variant: "destructive", label: t.whatsapp.statusError, icon: WifiOff },
    };
    const cfg = map[status] || map.disconnected;
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant} className="text-xs"><Icon className="h-3 w-3 mr-1" /> {cfg.label}</Badge>;
  };



  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">{t.whatsapp.title}</h1>
            <p className="text-sm text-muted-foreground">{t.whatsapp.subtitle}</p>
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setShowNewModal(true)}
          disabled={planLimitsLoading || !canCreateInstance()}
          title={trialBlocked ? "Trial automático desativado para plano grátis" : instanceLimitReached ? "Limite de instâncias do plano atingido" : "Nova Instância"}
        >
          <Plus className="h-4 w-4 mr-2" /> {t.whatsapp.newInstance}
        </Button>
      </div>

      {trialBlocked && (
        <p className="text-sm text-destructive">
          Trial automático desativado: o plano Grátis está bloqueado. Faça upgrade para liberar novas instâncias.
        </p>
      )}

      {!trialBlocked && instanceLimitReached && plan && (
        <p className="text-sm text-destructive">
          Limite atingido: {usage?.instances}/{plan.max_instances} instância(s). Faça upgrade para criar outra.
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{t.whatsapp.totalInstances}</p>
          <div className="flex items-center gap-2 mt-1"><Smartphone className="h-5 w-5 text-muted-foreground" /><span className="text-2xl font-bold">{instances.length}</span></div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{t.whatsapp.connected}</p>
          <div className="flex items-center gap-2 mt-1"><Wifi className="h-5 w-5 text-primary" /><span className="text-2xl font-bold text-primary">{connected}</span></div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{t.whatsapp.disconnected}</p>
          <div className="flex items-center gap-2 mt-1"><WifiOff className="h-5 w-5 text-destructive" /><span className="text-2xl font-bold text-destructive">{disconnected}</span></div>
        </CardContent></Card>
      </div>

      {/* Instance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {instances.map((inst) => (
            <motion.div key={inst.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.25 }}>
              <Card className="border-border overflow-hidden hover:border-primary/30 transition-colors">
                {/* Status bar on top */}
                <div className={`h-1 w-full ${inst.status === "connected" ? "bg-green-500" : inst.status === "error" ? "bg-destructive" : inst.status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                <CardContent className="py-5 space-y-4">
                  {/* Header: icon + name + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${inst.status === "connected" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {inst.channel_type === "instagram" ? (
                          <Instagram className="h-5 w-5" />
                        ) : (
                          <Smartphone className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate text-foreground">{inst.instance_name}</p>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{inst.phone
                            ? inst.phone.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4")
                            : "Sem número"}</span>
                        </div>
                      </div>
                    </div>
                    {statusBadge(inst.status)}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {inst.status === "connected" ? (
                      <>
                        <Button size="sm" className="gap-1.5" onClick={() => navigate(`/conversas?instance=${inst.id}`)}>
                          <MessageSquare className="h-3.5 w-3.5" /> {t.whatsapp.conversations}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" title="Configurar Webhook" onClick={() => setWebhook(inst.id)}>
                          <Settings2 className="h-3.5 w-3.5" /> Webhook
                        </Button>
                        <div className="flex-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Configurações" onClick={() => setSettingsInstance(inst)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Desconectar" onClick={() => setConfirmDisconnect(inst)}>
                          <WifiOff className="h-4 w-4" />
                        </Button>
                      </>
                    ) : inst.status === "error" || inst.status === "disconnected" ? (
                      <>
                        <Button size="sm" className="gap-1.5" onClick={() => handleReconnect(inst)}>
                          <RefreshCw className="h-3.5 w-3.5" /> {t.whatsapp.reconnect}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" title="Verificar status da conexão" onClick={async () => {
                          toast.loading("Verificando conexão...", { id: "sync-status" });
                          const res = await checkInstanceStatus(inst.id);
                          if (res?.status === "connected") {
                            toast.success("Instância conectada com sucesso!", { id: "sync-status" });
                            await fetchInstances();
                          } else {
                            toast.info("Status na Evolution: " + (res?.status || "desconectado"), { id: "sync-status" });
                            await fetchInstances();
                          }
                        }}>
                          <CheckCircle className="h-3.5 w-3.5" /> Sincronizar
                        </Button>
                        <div className="flex-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Configurações" onClick={() => setSettingsInstance(inst)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" className="gap-1.5" onClick={() => { setQrData(inst.qr_code); setShowConnectModal(inst); }}>
                          <QrCode className="h-3.5 w-3.5" /> Conectar
                        </Button>
                        <div className="flex-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Configurações" onClick={() => setSettingsInstance(inst)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Excluir"
                      onClick={() => setConfirmDelete(inst)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {instances.length === 0 && hasFetched && (
          <div className="col-span-full text-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg">{t.whatsapp.noInstances}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.whatsapp.noInstancesDesc}</p>
          </div>
        )}
      </div>

      {/* New Instance Modal */}
      <Dialog open={showNewModal} onOpenChange={(open) => {
        setShowNewModal(open);
        if (open) setNewChannelType("whatsapp");
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {newChannelType === "instagram" ? "Nova Instância Instagram" : "Nova Instância WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {newChannelType === "instagram" 
              ? "Adicione uma nova instância para conectar ao Instagram Direct."
              : "Adicione uma nova instância para conectar ao WhatsApp."}
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="inst-name">{t.whatsapp.instanceName}</Label>
              <Input id="inst-name" placeholder={t.whatsapp.instanceNamePlaceholder} value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Canal de Comunicação (WhatsApp ou Instagram)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button"
                  variant={newChannelType === "whatsapp" ? "default" : "outline"}
                  className="flex flex-col h-20 gap-2 items-center justify-center"
                  onClick={() => setNewChannelType("whatsapp")}
                >
                  <Smartphone className="h-6 w-6" />
                  <span className="text-xs font-semibold">WhatsApp</span>
                </Button>
                <Button 
                  type="button"
                  variant={newChannelType === "instagram" ? "default" : "outline"}
                  className="flex flex-col h-20 gap-2 items-center justify-center"
                  onClick={() => setNewChannelType("instagram")}
                >
                  <Instagram className="h-6 w-6" />
                  <span className="text-xs font-semibold">Instagram</span>
                </Button>
              </div>
            </div>
            {trialBlocked && (
              <p className="text-xs text-destructive">
                Trial automático desativado: o plano Grátis está bloqueado para criação de instâncias.
              </p>
            )}
            {!trialBlocked && instanceLimitReached && plan && (
              <p className="text-xs text-destructive">
                Você atingiu o limite do plano ({usage?.instances}/{plan.max_instances} instância(s)).
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>{t.common.cancel}</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating || !canCreateInstance()}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {newChannelType === "instagram" ? "Criar Instância Instagram" : "Criar Instância WhatsApp"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect Modal */}
      <Dialog open={!!showConnectModal} onOpenChange={(open) => {
        if (!open) {
          setShowConnectModal(null);
          setInstaUsername("");
          setInstaPassword("");
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar {showConnectModal?.instance_name}</DialogTitle>
          </DialogHeader>
          
          {showConnectModal?.channel_type === "instagram" ? (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Insira suas credenciais do Instagram para conectar o Direct.</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="insta-user">Usuário / Email</Label>
                  <Input 
                    id="insta-user" 
                    placeholder="Seu usuário do Instagram" 
                    value={instaUsername} 
                    onChange={(e) => setInstaUsername(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="insta-pass">Senha</Label>
                  <Input 
                    id="insta-pass" 
                    type="password" 
                    placeholder="Sua senha" 
                    value={instaPassword} 
                    onChange={(e) => setInstaPassword(e.target.value)} 
                  />
                </div>
              </div>
              <Button 
                className="w-full gap-2" 
                onClick={() => showConnectModal && handleConnect(showConnectModal)}
                disabled={!instaUsername || !instaPassword || creating}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
                Conectar Instagram
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Escaneie o QR Code para vincular seu WhatsApp.</p>

              {qrData ? (
                <div className="space-y-4 mt-2">
                  <div className="flex justify-center">
                    <div className="w-56 h-56 bg-white rounded-lg flex items-center justify-center p-2">
                      <img src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => showConnectModal && handleConnect(showConnectModal)}>
                      <RefreshCw className="h-4 w-4" /> Atualizar QR
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 mt-2 text-center">
                  <p className="text-sm text-muted-foreground">QR Code não disponível. Clique para gerar.</p>
                  <Button className="gap-2" onClick={() => showConnectModal && handleConnect(showConnectModal)}>
                    <QrCode className="h-4 w-4" /> Gerar QR Code
                  </Button>
                </div>
              )}

              {polling && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando conexão...
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground mt-2">
                Abra o WhatsApp → Configurações → Aparelhos Conectados → Escanear código.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={!!showSuccessModal} onOpenChange={() => setShowSuccessModal(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="flex justify-center mb-2">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-primary/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
          </motion.div>
          <h2 className="text-xl font-bold">Tudo Pronto! 🎉</h2>
          <p className="text-sm text-muted-foreground mt-2">
            A instância <strong>{showSuccessModal?.instance_name}</strong> foi conectada com sucesso.
          </p>
          <Button className="w-full mt-4" onClick={() => setShowSuccessModal(null)}>Começar a usar</Button>
        </DialogContent>
      </Dialog>

      {/* Confirm Disconnect */}
      <AlertDialog open={!!confirmDisconnect} onOpenChange={() => setConfirmDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Desconectar instância?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A instância <strong>{confirmDisconnect?.instance_name}</strong> será desconectada do WhatsApp. Você poderá reconectá-la depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDisconnect && handleDisconnect(confirmDisconnect)}>
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Excluir instância?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A instância <strong>{confirmDelete?.instance_name}</strong> será excluída permanentemente. Todas as conversas vinculadas perderão a instância. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Instance Settings Modal */}
      {settingsInstance && (
        <InstanceSettingsModal
          open={!!settingsInstance}
          onOpenChange={(open) => !open && setSettingsInstance(null)}
          instanceId={settingsInstance.id}
          instanceName={settingsInstance.instance_name}
        />
      )}
    </div>
  );
}
