import { DashboardMetrics, ChartDataPoint } from "@/hooks/useDashboardMetrics";

export function exportDashboardCsv(metrics: DashboardMetrics, chartData: ChartDataPoint[], period: string) {
  const lines: string[] = [];

  lines.push("=== Resumo ===");
  lines.push("Metrica,Valor");
  lines.push(`Total de conversas,${metrics.totalConversations}`);
  lines.push(`Mensagens recebidas,${metrics.inboundMessages}`);
  lines.push(`Mensagens enviadas,${metrics.outboundMessages}`);
  lines.push(`Contatos,${metrics.totalContacts}`);
  lines.push(`Respostas IA,${metrics.aiMessages}`);
  lines.push(`Respostas manuais,${metrics.manualMessages}`);
  lines.push(`Instancias conectadas,${metrics.activeInstances}`);
  lines.push(`Agendamentos pendentes,${metrics.pendingSchedules}`);
  lines.push("");

  if (chartData.length > 0) {
    lines.push("=== Evolucao Diaria ===");
    lines.push("Data,Recebidas,IA,Manual");
    for (const point of chartData) {
      lines.push(`${point.date},${point.inbound},${point.ai},${point.manual}`);
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
