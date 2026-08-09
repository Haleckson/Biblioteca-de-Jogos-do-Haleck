import { jsPDF } from "jspdf";

export interface PDFReportData {
  backupType: "Geral (Biblioteca Completa)" | "Profundo (Jogo Individual)";
  gameName?: string;
  timestamp: string;
  stats: {
    totalGamesProcessed: number;
    syncedGamesCount: number;
    skippedGamesCount: number;
    filesUploadedCount: number;
  };
  uploadedItems: Array<{
    game: string;
    file: string;
    type: "Capa WebP" | "Ícone WebP" | "Texto Diário" | "Mídia WebP" | "Vídeo WebM" | "Vídeo MP4" | "Vídeo Anexo" | "Atalho YouTube";
    status: "Novo" | "Atualizado";
  }>;
  youtubeVideos: Array<{
    gameName: string;
    title: string;
    url: string;
    expectedFilename: string;
  }>;
  obsoleteItemsForManualDelete: Array<{
    gameName: string;
    itemName: string;
    itemType: "Pasta de Jogo Removida" | "Entrada de Diário Removida" | "Mídia Desassociada" | "Pasta Temporária Obsoleta";
  }>;
  errors: string[];
}

/**
 * Generates a styled dark-theme PDF report matching the application's visual identity.
 * Renders all items completely without truncation, using dynamic multi-line wrapping.
 */
export function generateBackupPDFReport(data: PDFReportData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12; // 12mm margins
  const contentWidth = pageWidth - margin * 2; // 186mm
  let y = margin;

  // Background Dark Fill
  const drawPageBackground = () => {
    doc.setFillColor(15, 17, 23); // #0f1117 dark background
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  };

  drawPageBackground();

  // Helper to check page overflow and add new page
  const checkPageOverflow = (heightNeeded: number, onNewPage?: () => void) => {
    if (y + heightNeeded > pageHeight - margin - 10) {
      doc.addPage();
      drawPageBackground();
      y = margin;
      if (onNewPage) {
        onNewPage();
      }
    }
  };

  // Header Banner (Page 1)
  doc.setFillColor(24, 28, 38);
  doc.rect(margin, y, contentWidth, 28, "F");
  doc.setDrawColor(6, 182, 212); // Cyan border
  doc.setLineWidth(0.6);
  doc.rect(margin, y, contentWidth, 28, "D");

  // Title
  doc.setTextColor(6, 182, 212); // Cyan #06b6d4
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("BIBLIOTECA DE JOGOS - RELATÓRIO DE BACKUP", margin + 6, y + 10);

  doc.setTextColor(228, 228, 231); // Zinc 200
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Tipo: ${data.backupType}${data.gameName ? ` (${data.gameName})` : ""}`, margin + 6, y + 18);
  doc.text(`Data: ${data.timestamp}`, margin + 6, y + 23);

  y += 34;

  // Summary Stats Section
  checkPageOverflow(30);
  doc.setFillColor(24, 28, 38);
  doc.rect(margin, y, contentWidth, 26, "F");

  doc.setTextColor(6, 182, 212);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("RESUMO DA SINCRONIZAÇÃO COM O GOOGLE DRIVE", margin + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(212, 212, 216);

  const colWidth = contentWidth / 2;
  doc.text(`• Jogos Processados: ${data.stats.totalGamesProcessed}`, margin + 4, y + 14);
  doc.text(`• Jogos Sincronizados/Atualizados: ${data.stats.syncedGamesCount}`, margin + 4, y + 20);
  doc.text(`• Jogos Sem Alterações (Inalterados): ${data.stats.skippedGamesCount}`, margin + colWidth, y + 14);
  doc.text(`• Arquivos Enviados/Atualizados: ${data.stats.filesUploadedCount}`, margin + colWidth, y + 20);

  y += 32;

  // Section 1: Uploaded/Updated Files
  if (data.uploadedItems.length > 0) {
    const drawTableHeader = () => {
      doc.setTextColor(6, 182, 212);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(`1. ARQUIVOS ENVIADOS E SINCRONIZADOS NA SESSÃO (${data.uploadedItems.length})`, margin, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(161, 161, 170);

      // Column headers
      doc.text("JOGO", margin + 2, y);
      doc.text("ARQUIVO", margin + 48, y);
      doc.text("FORMATO", margin + 130, y);
      doc.text("AÇÃO", margin + 162, y);
      y += 3;

      doc.setDrawColor(39, 39, 42);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentWidth, y);
      y += 4;
    };

    checkPageOverflow(20);
    drawTableHeader();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    // Column widths: Jogo = 44mm, Arquivo = 80mm, Formato = 30mm, Ação = 24mm
    data.uploadedItems.forEach((item) => {
      const gameLines = doc.splitTextToSize(item.game, 44);
      const fileLines = doc.splitTextToSize(item.file, 80);
      const maxLines = Math.max(gameLines.length, fileLines.length, 1);
      const rowHeight = maxLines * 3.8 + 2;

      checkPageOverflow(rowHeight, () => {
        drawTableHeader();
      });

      doc.setTextColor(228, 228, 231);
      doc.text(gameLines, margin + 2, y);
      doc.text(fileLines, margin + 48, y);

      doc.setTextColor(161, 161, 170);
      doc.text(item.type, margin + 130, y);

      if (item.status === "Novo") {
        doc.setTextColor(34, 197, 94); // Green #22c55e
      } else {
        doc.setTextColor(59, 130, 246); // Blue #3b82f6
      }
      doc.text(item.status, margin + 162, y);

      y += rowHeight;
    });

    y += 4;
  }

  // Section 2: YouTube Videos Uploaded/Created in THIS Session
  if (data.youtubeVideos.length > 0) {
    checkPageOverflow(22);
    doc.setTextColor(234, 179, 8); // Yellow/Amber
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`2. VÍDEOS / ATALHOS YOUTUBE PROCESSADOS NESTA SESSÃO (${data.youtubeVideos.length})`, margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(212, 212, 216);
    doc.text("Aviso: Apenas atalhos de vídeos salvos ou atualizados no Google Drive durante esta execução.", margin, y);
    y += 6;

    data.youtubeVideos.forEach((yt) => {
      const titleLines = doc.splitTextToSize(`• Jogo: ${yt.gameName} | Título: ${yt.title}`, contentWidth - 6);
      const urlLines = doc.splitTextToSize(`  Link: ${yt.url}`, contentWidth - 6);
      const fileLines = doc.splitTextToSize(`  Arquivo no Drive: ${yt.expectedFilename}`, contentWidth - 6);

      const cardLinesCount = titleLines.length + urlLines.length + fileLines.length;
      const cardHeight = cardLinesCount * 3.8 + 5;

      checkPageOverflow(cardHeight + 3);

      doc.setFillColor(24, 28, 38);
      doc.rect(margin, y, contentWidth, cardHeight, "F");
      doc.setDrawColor(234, 179, 8);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, cardHeight, "D");

      let currentCardY = y + 4;

      doc.setTextColor(6, 182, 212);
      doc.setFont("helvetica", "bold");
      doc.text(titleLines, margin + 3, currentCardY);
      currentCardY += titleLines.length * 3.8;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(250, 204, 21); // Amber
      doc.text(urlLines, margin + 3, currentCardY);
      currentCardY += urlLines.length * 3.8;

      doc.setTextColor(161, 161, 170);
      doc.text(fileLines, margin + 3, currentCardY);

      y += cardHeight + 4;
    });

    y += 2;
  }

  // Section 3: Obsolete Items Requiring Manual Deletion on Drive
  if (data.obsoleteItemsForManualDelete.length > 0) {
    checkPageOverflow(22);
    doc.setTextColor(249, 115, 22); // Orange #f97316
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`3. ITENS PARA REMOÇÃO MANUAL NO DRIVE (${data.obsoleteItemsForManualDelete.length})`, margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(212, 212, 216);
    doc.text(
      "Por segurança, o app não exclui arquivos do Google Drive. Os itens abaixo não existem mais no site:",
      margin,
      y
    );
    y += 6;

    data.obsoleteItemsForManualDelete.forEach((obs) => {
      const fullText = `[REMOVER MANUALMENTE NO DRIVE] ${obs.itemName} (${obs.itemType}) - Jogo: ${obs.gameName}`;
      const wrappedLines = doc.splitTextToSize(fullText, contentWidth - 4);
      const blockHeight = wrappedLines.length * 3.8 + 2;

      checkPageOverflow(blockHeight);

      doc.setTextColor(248, 113, 113); // Light Red
      doc.setFont("helvetica", "normal");
      doc.text(wrappedLines, margin + 2, y);

      y += blockHeight;
    });

    y += 4;
  }

  // Section 4: Errors/Warnings
  if (data.errors.length > 0) {
    checkPageOverflow(18);
    doc.setTextColor(239, 68, 68); // Red #ef4444
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`4. OCORRÊNCIAS E ERROS REGISTRADOS (${data.errors.length})`, margin, y);
    y += 5;

    data.errors.forEach((err) => {
      const wrappedLines = doc.splitTextToSize(`• ${err}`, contentWidth - 4);
      const blockHeight = wrappedLines.length * 3.8 + 2;

      checkPageOverflow(blockHeight);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(252, 165, 165);
      doc.text(wrappedLines, margin + 2, y);

      y += blockHeight;
    });
  }

  // Add Page Numbers Footer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122); // Zinc 500
    doc.text(
      `Biblioteca de Jogos - Relatório de Backup | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  // Save the generated PDF file
  const fileName = `Relatorio_Backup_Drive_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
