// Gera o relatório PDF da análise de backup no navegador (somente apresentação).
import type { BackupAiReview, BackupProfile } from "@/services/WorkspaceBackupAnalysisService";

export async function buildBackupReviewPdf(opts: {
  workspaceName?: string | null; profile: BackupProfile; review: BackupAiReview | null;
  labels: Record<string, string>;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15, maxW = W - 2 * M;
  let y = M;
  const ensure = (h: number) => { if (y + h > 282) { doc.addPage(); y = M; } };
  const text = (t: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(t, maxW) as string[]) { ensure(size * 0.5); doc.text(line, M, y); y += size * 0.45; }
    y += 1.5;
  };
  text("Análise de backup — Finance OS", 16, true);
  text(`Workspace: ${opts.workspaceName ?? "—"}   Gerado em: ${new Date().toLocaleString("pt-BR")}`, 9);
  text(`Backup exportado em: ${opts.profile.exportedAt ? new Date(opts.profile.exportedAt).toLocaleString("pt-BR") : "—"}`, 9);
  y += 2;
  const r = opts.review;
  if (r) {
    text("Resumo", 12, true); text(r.summary);
    if (r.replacement) { text("O que a restauração substituiria", 12, true); text(r.replacement); }
    if (r.differences?.length) { text("Diferenças notáveis", 12, true); r.differences.forEach((d) => text(`• ${d}`)); }
    if (r.inconsistencies.length) { text("Possíveis inconsistências", 12, true); r.inconsistencies.forEach((i) => text(`• [${i.severity}] ${i.description}`)); }
    text("Recomendação", 12, true); text(r.recommendation);
  }
  if (opts.profile.issues.length) { text("Problemas detectados no arquivo", 12, true); opts.profile.issues.forEach((i) => text(`• ${i}`)); }
  if (opts.profile.comparison?.length) {
    text("Registros: atual × backup", 12, true);
    doc.setFontSize(9);
    const row = (a: string, b: string, c: string, d: string, bold = false) => {
      ensure(5); doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(a, M, y); doc.text(b, 140, y, { align: "right" }); doc.text(c, 165, y, { align: "right" }); doc.text(d, W - M, y, { align: "right" }); y += 5;
    };
    row("Tipo", "Atual", "Backup", "Diferença", true);
    for (const c of opts.profile.comparison)
      row(opts.labels[c.table] ?? c.table, String(c.current), String(c.backup), (c.delta > 0 ? "+" : "") + c.delta);
  }
  y += 3;
  text("Análise gerada por IA a partir de um resumo do arquivo (sem lançamentos nem valores). Confira antes de restaurar.", 8);
  return doc.output("blob");
}
