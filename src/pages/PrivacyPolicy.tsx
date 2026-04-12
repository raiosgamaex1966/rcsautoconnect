import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function PrivacyPolicy() {
  const { t } = useLanguage();
  const pp = (t as any).privacy ?? fallback;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">{pp.title}</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-sm dark:prose-invert max-w-none"
        >
          <p className="text-muted-foreground text-sm mb-8">{pp.lastUpdated}: {new Date().toLocaleDateString()}</p>

          {pp.sections.map((section: { title: string; content: string }, i: number) => (
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
            <p className="text-sm text-muted-foreground mb-4">{pp.questions}</p>
            <Link to="/">
              <Button variant="outline">{pp.backHome}</Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

const fallback = {
  title: "Política de Privacidade",
  lastUpdated: "Última atualização",
  questions: "Dúvidas? Entre em contato conosco.",
  backHome: "Voltar ao início",
  sections: [
    { title: "1. Informações que coletamos", content: "Coletamos informações que você nos fornece diretamente, como nome, email, telefone e dados da empresa ao criar sua conta. Também coletamos dados de uso automaticamente, incluindo endereço IP, tipo de navegador, páginas visitadas e horários de acesso." },
    { title: "2. Como usamos suas informações", content: "Utilizamos suas informações para:\n• Fornecer, manter e melhorar nossos serviços\n• Processar transações e enviar notificações relacionadas\n• Personalizar sua experiência de uso\n• Analisar tendências e monitorar a utilização do serviço\n• Detectar, prevenir e resolver problemas técnicos e de segurança" },
    { title: "3. Compartilhamento de dados", content: "Não vendemos, alugamos ou compartilhamos suas informações pessoais com terceiros para fins de marketing. Podemos compartilhar dados com prestadores de serviço que nos auxiliam na operação da plataforma, sempre sob obrigações de confidencialidade." },
    { title: "4. Cookies e tecnologias similares", content: "Utilizamos cookies e tecnologias similares para coletar informações sobre sua navegação, melhorar a experiência do usuário e analisar o tráfego. Você pode controlar o uso de cookies através das configurações do seu navegador ou pelo nosso banner de consentimento." },
    { title: "5. Segurança dos dados", content: "Implementamos medidas de segurança técnicas e organizacionais adequadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui criptografia, controles de acesso e monitoramento contínuo." },
    { title: "6. Seus direitos (LGPD)", content: "De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:\n• Acessar seus dados pessoais\n• Corrigir dados incompletos ou desatualizados\n• Solicitar a exclusão de seus dados\n• Revogar o consentimento a qualquer momento\n• Solicitar a portabilidade dos dados" },
    { title: "7. Retenção de dados", content: "Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletados, incluindo obrigações legais, contratuais e regulatórias." },
    { title: "8. Alterações nesta política", content: "Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas através do nosso serviço ou por email. O uso continuado dos serviços após as alterações constitui aceitação da política atualizada." },
  ],
};
