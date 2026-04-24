import { useNavigate } from "react-router-dom";
import {
  Smartphone, MessageCircle, Bot, CalendarDays, BookOpen, BarChart3,
  ChevronDown, ChevronRight, CheckCircle2, Circle, Headphones,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFloatingButtonPhone } from "@/hooks/useFloatingButtonPhone";

interface Step { label: string; desc: string }
interface Group { title: string; steps: Step[]; link?: string; linkPath?: string }
interface Section { id: number; title: string; subtitle: string; icon: React.ElementType; groups: Group[] }

function SectionBlock({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <Card>
      <CardContent className="py-3 sm:py-5">
        <button className="w-full flex items-center justify-between" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium shrink-0">{t.howToUse.sectionLabel} {section.id}</span>
            <h2 className="text-sm sm:text-lg font-bold truncate">{section.title}</h2>
          </div>
          {open ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />}
        </button>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">{section.subtitle}</p>

        {open && (
          <div className="mt-4 sm:mt-6 space-y-5 sm:space-y-8">
            {section.groups.map((group, gi) => (
              <div key={gi}>
                <h3 className="font-semibold text-xs sm:text-sm flex items-center gap-2 mb-2 sm:mb-3 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {group.title}
                </h3>
                <div className="space-y-2 sm:space-y-3 ml-1">
                  {group.steps.map((step, si) => (
                    <div key={si} className="flex items-start gap-2 sm:gap-3">
                      <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium">{step.label}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {group.link && group.linkPath && (
                  <button
                    className="text-[10px] sm:text-xs text-primary hover:underline mt-2 sm:mt-3 ml-5 sm:ml-6 flex items-center gap-1"
                    onClick={() => navigate(group.linkPath!)}
                  >
                    {t.howToUse.goTo} {group.link} →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComoUsar() {
  const { t } = useLanguage();
  const { openWhatsApp } = useFloatingButtonPhone();

  const s = t.howToUse.sections;

  const buildGroups = (sectionGroups: Record<string, any>): Group[] =>
    Object.values(sectionGroups).map((g: any) => ({
      title: g.title,
      steps: g.steps,
      link: g.link,
      linkPath: g.linkPath,
    }));

  const sections: Section[] = [
    { id: 1, title: s.s1.title, subtitle: s.s1.subtitle, icon: Smartphone, groups: buildGroups(s.s1.groups) },
    { id: 2, title: s.s2.title, subtitle: s.s2.subtitle, icon: MessageCircle, groups: buildGroups(s.s2.groups) },
    { id: 3, title: s.s3.title, subtitle: s.s3.subtitle, icon: Bot, groups: buildGroups(s.s3.groups) },
    { id: 4, title: s.s4.title, subtitle: s.s4.subtitle, icon: CalendarDays, groups: buildGroups(s.s4.groups) },
    { id: 5, title: s.s5.title, subtitle: s.s5.subtitle, icon: BookOpen, groups: buildGroups(s.s5.groups) },
    { id: 6, title: s.s6.title, subtitle: s.s6.subtitle, icon: BarChart3, groups: buildGroups(s.s6.groups) },
  ];

  const quickCards = sections.map((sec) => ({
    icon: sec.icon,
    num: sec.id,
    title: sec.title,
    desc: sec.subtitle,
  }));

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 w-full">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t.howToUse.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{t.howToUse.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {quickCards.map((c, i) => (
          <Card key={i} className="cursor-pointer hover:border-primary/40 transition-colors">
            <CardContent className="py-3 sm:py-4 text-center">
              <c.icon className="h-5 w-5 sm:h-6 sm:w-6 mx-auto mb-1.5 sm:mb-2 text-muted-foreground" />
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{c.num}</p>
              <p className="text-[10px] sm:text-xs font-semibold">{c.title}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {sections.map((sec) => (
          <SectionBlock key={sec.id} section={sec} />
        ))}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4 sm:py-6 text-center space-y-2">
          <p className="text-xs sm:text-sm">{t.howToUse.supportCTA}</p>
          <button
            className="text-primary text-xs sm:text-sm font-medium hover:underline flex items-center gap-2 mx-auto"
            onClick={() => openWhatsApp("Olá! Preciso de suporte.")}
          >
            <Headphones className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {t.howToUse.talkToSupport}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
