import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Bot, Building2, Shield, Bell, CreditCard, SlidersHorizontal,
  AlertTriangle, BookOpen, Calendar, FileText, Plus, CheckCircle2,
  Camera, Eye, EyeOff, User, Crown, MessageCircle, Users, Upload, X, Trash2,
  Loader2, Key,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAISettings } from "@/hooks/useAISettings";
import { useKBDocuments } from "@/hooks/useKBDocuments";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useLanguage } from "@/contexts/LanguageContext";

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs sm:text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="text-sm pr-10" />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(!show)}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function NotificationRow({ title, desc, defaultChecked }: { title: string; desc: string; defaultChecked: boolean }) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-xs sm:text-sm">{title}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch defaultChecked={defaultChecked} className="shrink-0" />
    </div>
  );
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { settings: ai, update: updateAI, save: saveAI, loading: aiLoading, saving: aiSaving } = useAISettings();
  const { documents, loading: kbLoading, upload: kbUpload, remove: kbRemove, reprocess: kbReprocess } = useKBDocuments();
  const { preferences, update: updatePrefs, save: savePrefs, loading: prefsLoading, saving: prefsSaving } = useUserPreferences();
  const { t, setLanguage } = useLanguage();
  const [tab, setTab] = useState("negocio");

  const configTabs = [
    { value: "negocio", label: t.settings.tabs.business, icon: Bot },
    { value: "perfil", label: t.settings.tabs.profile, icon: Building2 },
    { value: "seguranca", label: t.settings.tabs.security, icon: Shield },
    { value: "notificacoes", label: t.settings.tabs.notifications, icon: Bell },
    { value: "plano", label: t.settings.tabs.plan, icon: CreditCard },
    { value: "preferencias", label: t.settings.tabs.preferences, icon: SlidersHorizontal },
  ];

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("outro");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    setProfileEmail(user.email || "");
    const loadProfile = async () => {
      setProfileLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, company")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name || "");
        setProfilePhone(data.phone || "");
        setCompanyName(data.company || "");
      }
      setProfileLoading(false);
    };
    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: profilePhone, company: companyName })
      .eq("user_id", user.id);
    if (error) { toast.error(t.settings.profile.savedError); }
    else { toast.success(t.settings.profile.savedOk); }
    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(t.settings.security.minChars);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t.settings.security.mismatch);
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message || t.common.error); }
    else { toast.success(t.settings.security.changedOk); setNewPassword(""); setConfirmPassword(""); }
    setChangingPassword(false);
  };

  const displayInitial = (fullName || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t.settings.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-3 px-3 sm:-mx-6 sm:px-6">
          <TabsList className="bg-secondary w-max sm:w-full">
            {configTabs.map((ct) => (
              <TabsTrigger key={ct.value} value={ct.value} className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3 sm:flex-1">
                <ct.icon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">{ct.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* NEGÓCIO E IA */}
        <TabsContent value="negocio" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base flex items-center gap-2">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> {t.settings.business.aiActive}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        {ai.ai_enabled ? t.settings.business.aiActiveDesc : t.settings.business.aiInactiveDesc}
                      </p>
                    </div>
                    <Switch checked={ai.ai_enabled} onCheckedChange={(v) => updateAI({ ai_enabled: v })} />
                  </div>
                </CardContent>
              </Card>

              {/* OpenAI Configuration */}
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Key className="h-4 w-4 sm:h-5 sm:w-5" /> Configuração OpenAI
                  </CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Configure sua chave da API e modelo da OpenAI para o assistente de IA.
                  </p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">Chave da API OpenAI</Label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={ai.openai_api_key}
                        onChange={(e) => updateAI({ openai_api_key: e.target.value })}
                        placeholder="sk-..."
                        className="text-sm pr-10 font-mono"
                      />
                      <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Obtenha em{" "}
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        platform.openai.com/api-keys
                      </a>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">Modelo</Label>
                    <Select value={ai.openai_model} onValueChange={(v) => updateAI({ openai_model: v })}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rápido e econômico)</SelectItem>
                        <SelectItem value="gpt-5">GPT-5 (Mais poderoso)</SelectItem>
                        <SelectItem value="gpt-5-mini">GPT-5 Mini (Equilíbrio custo/qualidade)</SelectItem>
                        <SelectItem value="gpt-5-nano">GPT-5 Nano (Ultra rápido e barato)</SelectItem>
                        <SelectItem value="gpt-5.2">GPT-5.2 (Último lançamento)</SelectItem>
                        <SelectItem value="o3">O3 (Raciocínio avançado)</SelectItem>
                        <SelectItem value="o3-mini">O3 Mini (Raciocínio rápido)</SelectItem>
                        <SelectItem value="o4-mini">O4 Mini (Raciocínio eficiente)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!ai.openai_api_key && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 sm:p-3 text-xs sm:text-sm flex gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p>A IA não funcionará sem uma chave da API OpenAI válida.</p>
                    </div>
                  )}
                  {ai.openai_api_key && (
                    <div className="rounded-lg bg-primary/10 border border-primary/30 p-2 sm:p-3 text-xs sm:text-sm flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <p>Chave configurada · Modelo: <span className="font-semibold text-primary">{ai.openai_model}</span></p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <Bot className="h-4 w-4 sm:h-5 sm:w-5" /> {t.settings.business.focusTitle}
                  </CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.business.focusSubtitle}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 sm:p-3 text-xs sm:text-sm flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p><strong>{t.settings.business.focusWarning}</strong></p>
                  </div>
                  <RadioGroup value={ai.focus_mode} onValueChange={(v) => updateAI({ focus_mode: v })} className="space-y-2">
                    <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border ${ai.focus_mode === "base-conhecimento" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="base-conhecimento" id="bc" className="mt-1" />
                      <div className="min-w-0">
                        <Label htmlFor="bc" className="font-medium text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                          <BookOpen className="h-3.5 w-3.5" /> {t.settings.business.knowledgeBase}
                          <Badge className="bg-primary text-[10px]">{t.settings.business.recommended}</Badge>
                        </Label>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{t.settings.business.knowledgeBaseDesc}</p>
                      </div>
                    </div>
                    <div className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border ${ai.focus_mode === "agendamentos" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="agendamentos" id="ag" className="mt-1" />
                      <div className="min-w-0">
                        <Label htmlFor="ag" className="font-medium text-xs sm:text-sm flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {t.settings.business.scheduling}
                        </Label>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{t.settings.business.schedulingDesc}</p>
                      </div>
                    </div>
                  </RadioGroup>
                  <div className="text-[10px] sm:text-xs text-muted-foreground bg-secondary p-2 rounded">
                    {t.common.mode}: <span className="text-primary font-medium">{ai.focus_mode === "base-conhecimento" ? t.settings.business.knowledgeBase : t.settings.business.scheduling}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Bot className="h-4 w-4 sm:h-5 sm:w-5" /> {t.settings.business.toneTitle}</CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.business.toneSubtitle}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.tone}</Label>
                    <Select value={ai.tone} onValueChange={(v) => updateAI({ tone: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amigavel">{t.settings.business.friendly}</SelectItem>
                        <SelectItem value="profissional">{t.settings.business.professional}</SelectItem>
                        <SelectItem value="formal">{t.settings.business.formal}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.generalInstructions}</Label>
                    <Textarea placeholder={t.settings.business.generalInstructionsPlaceholder} value={ai.general_instructions} onChange={(e) => updateAI({ general_instructions: e.target.value })} rows={4} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.formattingStyle}</Label>
                    <Textarea placeholder={t.settings.business.formattingStylePlaceholder} value={ai.formatting_style} onChange={(e) => updateAI({ formatting_style: e.target.value })} rows={3} className="text-sm" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">{t.settings.business.greetingsTitle}</CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.business.greetingsSubtitle}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.greeting}</Label>
                    <Textarea value={ai.greeting} onChange={(e) => updateAI({ greeting: e.target.value })} rows={2} className="text-sm" placeholder={t.settings.business.greetingPlaceholder} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.farewell}</Label>
                    <Textarea value={ai.farewell} onChange={(e) => updateAI({ farewell: e.target.value })} rows={2} className="text-sm" placeholder={t.settings.business.farewellPlaceholder} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-sm sm:text-base text-destructive">{t.settings.business.restrictionsTitle}</CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.business.restrictionsSubtitle}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.forbiddenResponses}</Label>
                    <Textarea value={ai.forbidden_responses} onChange={(e) => updateAI({ forbidden_responses: e.target.value })} rows={3} className="text-sm" placeholder={t.settings.business.forbiddenResponsesPlaceholder} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.humanTriggerWords}</Label>
                    <Input value={ai.human_trigger_words} onChange={(e) => updateAI({ human_trigger_words: e.target.value })} placeholder={t.settings.business.humanTriggerWordsPlaceholder} className="text-sm" />
                    <p className="text-[10px] text-muted-foreground">{t.settings.business.separateByComma}</p>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full text-xs sm:text-sm" onClick={async () => {
                const ok = await saveAI();
                if (ok) toast.success(t.settings.business.savedOk);
                else toast.error(t.settings.business.savedError);
              }} disabled={aiSaving}>
                {aiSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                {t.settings.business.saveAI}
              </Button>
            </div>

            {/* Right Column - Knowledge Base */}
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Building2 className="h-4 w-4 sm:h-5 sm:w-5" /> {t.settings.business.businessInfo}</CardTitle>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.business.businessInfoSubtitle}</p>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.business.companyName}</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t.settings.business.companyNamePlaceholder} className="text-sm" />
                  </div>
                  <div className="space-y-1"><Label className="text-xs sm:text-sm">{t.settings.business.businessType}</Label><Input value={ai.business_type} onChange={(e) => updateAI({ business_type: e.target.value })} placeholder={t.settings.business.businessTypePlaceholder} className="text-sm" /></div>
                  <div className="space-y-1"><Label className="text-xs sm:text-sm">{t.settings.business.businessHours}</Label><Input value={ai.business_hours} onChange={(e) => updateAI({ business_hours: e.target.value })} placeholder={t.settings.business.businessHoursPlaceholder} className="text-sm" /></div>
                  <Button className="w-full text-xs sm:text-sm" disabled={profileSaving} onClick={async () => {
                    setProfileSaving(true);
                    const { error: profileErr } = await supabase
                      .from("profiles")
                      .update({ company: companyName })
                      .eq("user_id", user?.id || "");
                    const aiOk = await saveAI();
                    setProfileSaving(false);
                    if (profileErr || !aiOk) {
                      toast.error(t.settings.business.businessSavedError);
                    } else {
                      toast.success(t.settings.business.businessSavedOk);
                    }
                  }}>
                    {profileSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {t.settings.business.saveBusinessInfo}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2 flex-wrap">
                        {t.settings.knowledgeBase.title} <Badge className="bg-primary text-[10px]">Ativo</Badge>
                      </CardTitle>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{t.settings.knowledgeBase.subtitle}</p>
                    </div>
                    <Button size="sm" className="text-xs shrink-0" onClick={() => setShowUploadDialog(true)}>
                      <Plus className="h-3 w-3 mr-1" /> {t.settings.knowledgeBase.addDocument}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 sm:h-12 sm:w-12 mb-3 opacity-30" />
                      <p className="font-medium text-sm">{t.settings.knowledgeBase.noDocuments}</p>
                      <p className="text-[10px] sm:text-xs">{t.settings.knowledgeBase.noDocumentsDesc}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => {
                        const sizeStr = doc.file_size_bytes < 1024 * 1024
                          ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB`
                          : `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`;
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border bg-secondary/30 gap-2">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs sm:text-sm font-medium truncate">{doc.title}</p>
                                  {doc.processing_status === "completed" && (
                                    <Badge variant="outline" className="text-[10px] border-primary text-primary">✓ {t.settings.knowledgeBase.status.completed}</Badge>
                                  )}
                                  {doc.processing_status === "processing" && (
                                    <Badge variant="outline" className="text-[10px]"><Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />{t.settings.knowledgeBase.status.processing}</Badge>
                                  )}
                                  {doc.processing_status === "pending" && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">{t.settings.knowledgeBase.status.pending}</Badge>
                                  )}
                                  {doc.processing_status === "error" && (
                                    <Badge variant="destructive" className="text-[10px] cursor-pointer" onClick={() => kbReprocess(doc).then(ok => ok ? toast.success("✓") : toast.error(t.common.error))}>
                                      ↻ {t.settings.knowledgeBase.reprocess}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{doc.doc_type} • {sizeStr}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-destructive shrink-0" onClick={async () => { await kbRemove(doc); toast.success(t.common.success); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upload Dialog */}
              <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg"><Upload className="h-4 w-4 sm:h-5 sm:w-5" /> {t.settings.knowledgeBase.uploadTitle}</DialogTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.knowledgeBase.subtitle}</p>
                  </DialogHeader>
                  <div className="space-y-3 sm:space-y-4 mt-2">
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) setUploadFile(file); }}
                    >
                      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setUploadFile(file); }} />
                      {uploadFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-xs sm:text-sm font-medium truncate max-w-[150px]">{uploadFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.knowledgeBase.dragDrop}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{t.settings.knowledgeBase.formats}</p>
                        </>
                      )}
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 sm:p-3">
                      <p className="text-[10px] sm:text-xs text-primary leading-relaxed">
                        {t.settings.knowledgeBase.markdownHint}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t.settings.knowledgeBase.docTitle}</Label>
                      <Input placeholder="" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t.settings.knowledgeBase.docType}</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faq">❓ {t.settings.knowledgeBase.types.faq}</SelectItem>
                          <SelectItem value="catalogo">📦 {t.settings.knowledgeBase.types.catalog}</SelectItem>
                          <SelectItem value="policy">📋 {t.settings.knowledgeBase.types.policy}</SelectItem>
                          <SelectItem value="outro">📄 {t.settings.knowledgeBase.types.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full text-xs sm:text-sm" disabled={!uploadFile || !docTitle.trim() || uploading} onClick={async () => {
                      if (!uploadFile || !docTitle.trim()) return;
                      setUploading(true);
                      const ok = await kbUpload(uploadFile, docTitle, docType);
                      setUploading(false);
                      if (ok) {
                        toast.success(t.common.success);
                        setUploadFile(null); setDocTitle(""); setDocType("outro"); setShowUploadDialog(false);
                      } else {
                        toast.error(t.common.error);
                      }
                    }}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                      {uploading ? t.settings.knowledgeBase.uploading : t.settings.knowledgeBase.upload}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </TabsContent>

        {/* PERFIL */}
        <TabsContent value="perfil" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:pt-6 space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold">{t.settings.profile.profileTitle}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.profile.profileSubtitle}</p>
              </div>
              <>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative shrink-0">
                      <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-primary flex items-center justify-center text-xl sm:text-3xl font-bold text-primary-foreground">
                        {displayInitial}
                      </div>
                      <button className="absolute bottom-0 right-0 h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-secondary border border-border flex items-center justify-center">
                        <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm sm:text-lg">{fullName || t.settings.profile.noName}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{profileEmail}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t.settings.profile.name}</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs sm:text-sm">{t.settings.profile.email}</Label>
                      <Input value={profileEmail} disabled className="text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs sm:text-sm">{t.settings.profile.phone}</Label>
                    <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="5562999999999" className="text-sm max-w-full sm:max-w-md" />
                  </div>
                  <Button className="text-xs sm:text-sm" onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {t.settings.profile.saveChanges}
                  </Button>
                </>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGURANÇA */}
        <TabsContent value="seguranca" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:pt-6 space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold">{t.settings.security.changePasswordTitle}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.security.keepSecure}</p>
              </div>
              <PasswordField label={t.settings.security.newPassword} value={newPassword} onChange={setNewPassword} />
              <PasswordField label={t.settings.security.confirmPassword} value={confirmPassword} onChange={setConfirmPassword} />
              <Button className="text-xs sm:text-sm" onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Shield className="h-3.5 w-3.5 mr-1.5" />}
                {changingPassword ? t.settings.security.changing : t.settings.security.changePassword}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:pt-6 space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold">{t.settings.notifications.notifPreferences}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.notifications.notifPreferencesDesc}</p>
              </div>
              <NotificationRow title={t.settings.notifications.browserNotifs} desc={t.settings.notifications.browserNotifsDesc} defaultChecked={false} />
              <Separator />
              <NotificationRow title={t.settings.notifications.soundNotifs} desc={t.settings.notifications.soundNotifsDesc} defaultChecked={true} />
              <Separator />
              <NotificationRow title={t.settings.notifications.aiResponseNotifs} desc={t.settings.notifications.aiResponseNotifsDesc} defaultChecked={true} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANO */}
        <TabsContent value="plano" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                name: t.settings.plan.freePlan, price: "R$ 0", period: "", badge: t.settings.plan.yourPlanBadge, badgeColor: "bg-secondary",
                icon: User, highlighted: false, cta: t.settings.plan.currentPlanBtn, ctaDisabled: true,
                features: ["1 WhatsApp", "7 dias", t.settings.notifications.browserNotifs],
                excluded: [t.settings.plan.documents, t.settings.plan.messages],
              },
              {
                name: t.settings.plan.proPlan, price: "R$ 49,90", period: t.settings.plan.perMonth, badge: t.settings.plan.popular, badgeColor: "bg-secondary",
                icon: Crown, highlighted: false, cta: t.settings.plan.subscribeNow, ctaDisabled: false,
                features: ["1 WhatsApp", "5 docs", "500 msg IA", "IA 24/7", "30 dias"],
                excluded: [],
              },
              {
                name: t.settings.plan.enterprisePlan, price: "R$ 99,90", period: t.settings.plan.perMonth, badge: t.settings.plan.recommendedBadge, badgeColor: "bg-primary",
                icon: Building2, highlighted: true, cta: t.settings.plan.subscribeNow, ctaDisabled: false,
                features: ["3 WhatsApp", "10 docs", "2.000 msg IA", "IA 24/7"],
                excluded: [],
              },
            ].map((plan, i) => (
              <Card key={i} className={`relative ${plan.highlighted ? "border-primary" : ""}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`${plan.badgeColor} text-[10px] sm:text-xs`}>{plan.badge}</Badge>
                  </div>
                )}
                <CardContent className="pt-6 sm:pt-8 pb-4 sm:pb-6 text-center space-y-3 sm:space-y-4 p-3 sm:p-6">
                  <plan.icon className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-sm sm:text-lg font-bold">{plan.name}</h3>
                    <span className="text-2xl sm:text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground text-xs sm:text-sm">{plan.period}</span>}
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 text-left">
                    {plan.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                    {plan.excluded.map((f, j) => (
                      <div key={j} className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full text-xs sm:text-sm"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={plan.ctaDisabled}
                    onClick={() => !plan.ctaDisabled && toast.success(t.settings.plan.redirecting.replace("{name}", plan.name))}
                  >{plan.cta}</Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-3 sm:pt-6 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold">{t.settings.plan.usage}</h2>
                <Badge variant="outline" className="text-[10px] sm:text-xs text-primary border-primary">Cache</Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.plan.usageSubtitle}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: t.settings.plan.messages, value: 0, icon: MessageCircle },
                  { label: t.settings.plan.conversations, value: 0, icon: Users },
                  { label: t.settings.plan.documents, value: documents.length, icon: FileText },
                ].map((s, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 sm:py-4 flex items-center gap-2 sm:gap-3">
                      <s.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-lg sm:text-2xl font-bold">{s.value}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREFERÊNCIAS */}
        <TabsContent value="preferencias" className="mt-4 sm:mt-6">
          <Card>
            <CardContent className="p-3 sm:pt-6 space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-xl font-bold">{t.settings.preferences.title}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">{t.settings.preferences.subtitle}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm font-medium">{t.settings.preferences.theme}</Label>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t.settings.preferences.themeDesc}</p>
                <Select value={preferences.theme} onValueChange={(v) => updatePrefs({ theme: v })}>
                  <SelectTrigger className="w-full sm:w-48 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">{t.settings.preferences.dark}</SelectItem>
                    <SelectItem value="light">{t.settings.preferences.light}</SelectItem>
                    <SelectItem value="system">{t.settings.preferences.system}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm font-medium">{t.settings.preferences.language}</Label>
                <Select value={preferences.language} onValueChange={(v) => {
                  updatePrefs({ language: v });
                  setLanguage(v as any);
                }}>
                  <SelectTrigger className="w-full sm:w-48 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm">{t.settings.preferences.aiDefault}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{t.settings.preferences.aiDefaultDesc}</p>
                </div>
                <Switch checked={preferences.ai_default_enabled} onCheckedChange={(v) => updatePrefs({ ai_default_enabled: v })} className="shrink-0" />
              </div>
              <Separator />
              <Button className="w-full sm:w-auto text-xs sm:text-sm" onClick={async () => {
                const ok = await savePrefs();
                if (ok) toast.success(t.settings.preferences.savedOk);
                else toast.error(t.settings.preferences.savedError);
              }} disabled={prefsSaving}>
                {prefsSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                {prefsSaving ? t.settings.preferences.saving : t.settings.preferences.save}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
