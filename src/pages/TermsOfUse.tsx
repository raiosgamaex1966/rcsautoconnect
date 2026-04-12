import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TermsOfUse() {
  const { t } = useLanguage();
  const terms = (t as any).terms ?? fallback;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">{terms.title}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-sm dark:prose-invert max-w-none"
        >
          <p className="text-muted-foreground text-sm mb-8">{terms.lastUpdated}: {new Date().toLocaleDateString()}</p>

          {terms.sections.map((section: { title: string; content: string }, i: number) => (
            <motion.section
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="mb-8"
            >
              <h2 className="text-lg font-semibold text-foreground mb-2">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
            </motion.section>
          ))}

          <div className="mt-12 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground mb-4">{terms.questions}</p>
            <Link to="/">
              <Button variant="outline">{terms.backHome}</Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

const fallback = {
  title: "Termos de Uso",
  lastUpdated: "Última atualização",
  questions: "Dúvidas? Entre em contato conosco.",
  backHome: "Voltar ao início",
  sections: [
    { title: "1. Aceitação dos Termos", content: "Ao acessar e utilizar a plataforma RCS AutoConnect, você concorda com estes Termos de Uso. Se não concordar com algum dos termos, não utilize nossos serviços." },
    { title: "2. Descrição do Serviço", content: "A plataforma RCS AutoConnect é uma solução de automação e gestão de atendimento via WhatsApp, oferecendo funcionalidades como:\n• Chatbot com inteligência artificial\n• Gestão de conversas e contatos\n• Agendamentos e lembretes automáticos\n• Painel de métricas e relatórios\n• Kanban de acompanhamento" },
    { title: "3. Cadastro e Conta", content: "Para utilizar a plataforma, é necessário criar uma conta fornecendo informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta." },
    { title: "4. Uso Aceitável", content: "Você se compromete a utilizar a plataforma de forma lícita e ética. É proibido:\n• Enviar spam ou mensagens em massa não solicitadas\n• Utilizar o serviço para atividades ilegais\n• Tentar acessar contas de outros usuários\n• Realizar engenharia reversa ou comprometer a segurança da plataforma\n• Violar direitos de propriedade intelectual de terceiros" },
    { title: "5. Planos e Pagamentos", content: "Os planos e preços estão disponíveis na plataforma. O pagamento deve ser realizado conforme as condições do plano contratado. Reservamo-nos o direito de alterar preços mediante aviso prévio. O período de teste gratuito, quando disponível, está sujeito às condições descritas no momento da contratação." },
    { title: "6. Propriedade Intelectual", content: "Todo o conteúdo da plataforma, incluindo código-fonte, design, logotipos, textos e funcionalidades, é de propriedade exclusiva da RCS AutoConnect e está protegido por leis de propriedade intelectual. É proibida a reprodução, distribuição ou modificação sem autorização prévia." },
    { title: "7. Limitação de Responsabilidade", content: "A RCS AutoConnect não se responsabiliza por:\n• Interrupções temporárias no serviço por manutenção ou fatores externos\n• Conteúdo das mensagens enviadas pelos usuários\n• Decisões comerciais tomadas com base nos dados da plataforma\n• Danos indiretos, incidentais ou consequenciais decorrentes do uso do serviço" },
    { title: "8. Suspensão e Cancelamento", content: "Reservamo-nos o direito de suspender ou cancelar contas que violem estes termos, sem aviso prévio em casos graves. O usuário pode cancelar sua conta a qualquer momento através das configurações da plataforma." },
    { title: "9. Alterações nos Termos", content: "Podemos atualizar estes Termos de Uso periodicamente. Mudanças significativas serão comunicadas por email ou notificação na plataforma. O uso continuado após as alterações constitui aceitação dos novos termos." },
    { title: "10. Foro e Legislação", content: "Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será submetida ao foro da comarca de domicílio do usuário, conforme previsto no Código de Defesa do Consumidor." },
  ],
};
