import { useState, useEffect, useCallback } from "react";
import {
  Rocket, Lightbulb, MessageCircle, Bot, CalendarDays,
  CreditCard, BarChart3, Smartphone, Users, Bell, Shield, Zap, Globe,
  Palette, FileText, Headphones, Loader2, ThumbsUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRoadmapItems } from "@/hooks/useRoadmapItems";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFloatingButtonPhone } from "@/hooks/useFloatingButtonPhone";

type RoadmapStatus = "done" | "in-progress" | "planned" | "idea";

const iconMap: Record<string, React.ElementType> = {
  Smartphone, Bot, FileText, BarChart3, MessageCircle, CreditCard,
  CalendarDays, Bell, Users, Zap, Globe, Shield, Palette, Headphones,
  Rocket, Lightbulb,
};

interface VoteData {
  roadmap_item_id: string;
  count: number;
  voted: boolean;
}

export default function Roadmap() {
  const { items, loading } = useRoadmapItems();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { openWhatsApp } = useFloatingButtonPhone();
  const [votes, setVotes] = useState<Record<string, VoteData>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  const statusConfig: Record<RoadmapStatus, { label: string; color: string; bgColor: string; sectionTitle: string }> = {
    done: { label: t.roadmap.status.done, color: "text-primary", bgColor: "bg-primary/10 border-primary/30", sectionTitle: t.roadmap.sections.done },
    "in-progress": { label: t.roadmap.status["in-progress"], color: "text-warning", bgColor: "bg-warning/10 border-warning/30", sectionTitle: t.roadmap.sections["in-progress"] },
    planned: { label: t.roadmap.status.planned, color: "text-info", bgColor: "bg-info/10 border-info/30", sectionTitle: t.roadmap.sections.planned },
    idea: { label: t.roadmap.status.idea, color: "text-muted-foreground", bgColor: "bg-secondary border-border", sectionTitle: t.roadmap.sections.idea },
  };

  const fetchVotes = useCallback(async () => {
    const { data: res } = await supabase.functions.invoke("data-api", {
      body: { _action: "roadmap-votes-list" },
    });

    if (!res?.success || !res.data) return;

    const voteMap: Record<string, VoteData> = {};
    for (const vote of res.data) {
      const id = vote.roadmap_item_id;
      if (!voteMap[id]) voteMap[id] = { roadmap_item_id: id, count: 0, voted: false };
      voteMap[id].count++;
      if (user && vote.user_id === user.id) voteMap[id].voted = true;
    }
    setVotes(voteMap);
  }, [user]);

  useEffect(() => { fetchVotes(); }, [fetchVotes]);

  const handleVote = async (itemId: string) => {
    if (!user) {
      toast.error(t.roadmap.loginToVote);
      return;
    }
    setVotingId(itemId);
    await supabase.functions.invoke("data-api", {
      body: { _action: "roadmap-vote", item_id: itemId },
    });
    await fetchVotes();
    setVotingId(null);
  };

  // Silent loading
  // if (loading) { ... }

  const visibleItems = items.filter((i) => i.visible);
  const grouped: Record<string, typeof visibleItems> = {};
  for (const item of visibleItems) {
    if (!grouped[item.status]) grouped[item.status] = [];
    grouped[item.status].push(item);
  }

  const statusOrder: RoadmapStatus[] = ["done", "in-progress", "planned", "idea"];
  const canVoteStatuses: RoadmapStatus[] = ["in-progress", "planned", "idea"];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-8 w-full">
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-1">
          <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">{t.roadmap.title}</h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t.roadmap.subtitle}
        </p>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {statusOrder.map((status) => {
          const config = statusConfig[status];
          const count = (grouped[status] || []).length;
          return (
            <Card key={status} className={`border ${config.bgColor}`}>
              <CardContent className="py-3 sm:py-4 text-center">
                <p className={`text-lg sm:text-2xl font-bold ${config.color}`}>{count}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sections */}
      {statusOrder.map((status) => {
        const sectionItems = grouped[status];
        if (!sectionItems || sectionItems.length === 0) return null;
        const config = statusConfig[status];
        const showVote = canVoteStatuses.includes(status);
        return (
          <div key={status} className="space-y-2 sm:space-y-3">
            <h2 className="text-sm sm:text-lg font-bold">{config.sectionTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {sectionItems.map((item) => {
                const Icon = iconMap[item.icon] || Zap;
                const voteData = votes[item.id];
                const voteCount = voteData?.count || 0;
                const hasVoted = voteData?.voted || false;
                return (
                  <Card key={item.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="py-3 sm:py-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 ${config.bgColor}`}>
                          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <p className="font-semibold text-xs sm:text-sm">{item.title}</p>
                            {item.version && (
                              <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                                {item.version}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {showVote && (
                            <Button
                              variant={hasVoted ? "default" : "outline"}
                              size="sm"
                              className={`h-7 gap-1 text-[10px] sm:text-xs px-2 ${hasVoted ? "bg-primary hover:bg-primary/90" : ""}`}
                              onClick={() => handleVote(item.id)}
                              disabled={votingId === item.id}
                            >
                              <ThumbsUp className={`h-3 w-3 ${hasVoted ? "fill-current" : ""}`} />
                              {voteCount > 0 && <span>{voteCount}</span>}
                            </Button>
                          )}
                          <Badge className={`text-[8px] sm:text-[10px] ${config.bgColor} ${config.color} border hidden sm:inline-flex`}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4 sm:py-6 text-center space-y-2">
          <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto" />
          <p className="font-semibold text-xs sm:text-sm">{t.roadmap.suggestion}</p>
          <p className="text-[10px] sm:text-sm text-muted-foreground">
            {t.roadmap.suggestionDesc}
          </p>
          <button className="text-primary text-xs sm:text-sm font-medium hover:underline flex items-center gap-2 mx-auto" onClick={() => openWhatsApp("Olá! Tenho uma sugestão para o RCS AutoConnect.")}>
            <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t.roadmap.sendSuggestion}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
