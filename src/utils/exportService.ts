import { Game, formatDateDisplay } from "../types";
import { showToast } from "./toast";
import { playRetroSound } from "./audioEffects";
import { cleanHTMLText } from "./htmlSanitizer";
import { applyDictionaryToHtml } from "./dictionaryUtils";

export function exportGameDiaryToMarkdown(game: Game) {
  playRetroSound("save");

  let md = `# 🎮 Diário de Jogatina: ${game.name}\n\n`;
  md += `**Plataforma:** ${game.platform}\n`;
  const statusList = Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : [];
  if (game.series) md += `**Série:** ${game.series}\n`;
  if (game.publisher) md += `**Publicadora:** ${game.publisher}\n`;
  if (statusList.length > 0) md += `**Status:** ${statusList.join(", ")}\n`;
  if (game.rating) md += `**Nota:** ⭐ ${game.rating} / 5\n`;
  if (game.playtime) md += `**Tempo Jogado:** ⏱️ ${game.playtime}\n`;
  if (game.startDate) md += `**Início:** ${formatDateDisplay(game.startDate)}\n`;
  if (game.endDate) md += `**Término:** ${formatDateDisplay(game.endDate)}\n`;
  md += `\n---\n\n`;

  if (game.pros) {
    md += `### 👍 Pontos Positivos\n${game.pros}\n\n`;
  }
  if (game.cons) {
    md += `### 👎 Pontos Negativos\n${game.cons}\n\n`;
  }

  md += `## 📖 Entradas do Diário\n\n`;

  if (game.diary && game.diary.length > 0) {
    game.diary.forEach((entry, idx) => {
      md += `### Registros ${idx + 1}: ${entry.period || "Sem data"}\n`;
      if (entry.keyMoments && entry.keyMoments.length > 0) {
        md += `*Momentos Chave: ${entry.keyMoments.map((km) => `\`${km}\``).join(" ")}*\n\n`;
      }
      md += `${entry.text}\n\n`;

      if (entry.medias && entry.medias.length > 0) {
        entry.medias.forEach((m, mIdx) => {
          if (!m.isVideo) {
            md += `![Mídia ${mIdx + 1}](${m.src})\n\n`;
          } else {
            md += `[Vídeo ${mIdx + 1}](${m.src})\n\n`;
          }
        });
      }
      md += `---\n\n`;
    });
  } else {
    md += `*Nenhuma entrada registrada no diário para este jogo.*\n\n`;
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${game.name.toLowerCase().replace(/\s+/g, "_")}_diario.md`;
  a.click();
  URL.revokeObjectURL(url);

  showToast({
    title: "Diário Exportado! 📝",
    message: `O arquivo Markdown de "${game.name}" foi baixado.`,
    type: "success",
  });
}

export function exportGameDiaryToPrintPDF(game: Game) {
  playRetroSound("save");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast({
      title: "Pop-up Bloqueado",
      message: "Por favor, permita pop-ups para gerar a impressão em PDF.",
      type: "warning",
    });
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Diário de Jogatina - ${game.name}</title>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #09090b !important;
            color: #f4f4f5 !important;
            margin: 0;
            padding: 30px;
            line-height: 1.6;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
          }
          .no-print {
            margin-bottom: 20px;
            background: #064e3b;
            border: 1px solid #10b981;
            color: #a7f3d0;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
          }
          .header-card {
            background-color: #18181b;
            border: 1px solid #27272a;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
          }
          h1 {
            color: #22d3ee;
            margin: 0 0 10px 0;
            font-size: 26px;
            font-weight: 900;
          }
          .meta-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            color: #a1a1aa;
            font-size: 13px;
            margin-bottom: 12px;
          }
          .meta-item {
            background: #27272a;
            padding: 4px 10px;
            border-radius: 8px;
            color: #e4e4e7;
          }
          .badge {
            background: #083344;
            color: #38bdf8;
            border: 1px solid #0e7490;
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 6px;
            display: inline-block;
          }
          .section-title {
            font-size: 18px;
            font-weight: 800;
            color: #a855f7;
            margin: 28px 0 16px 0;
            border-bottom: 1px solid #27272a;
            padding-bottom: 8px;
          }
          .entry-card {
            background-color: #18181b;
            border: 1px solid #27272a;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .entry-title {
            font-size: 15px;
            font-weight: 800;
            color: #38bdf8;
            margin-bottom: 10px;
          }
          .entry-text {
            color: #f4f4f5;
            font-size: 14px;
            line-height: 1.7;
            white-space: pre-wrap;
            margin-bottom: 15px;
            word-break: break-word;
          }
          .media-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 12px;
          }
          .media-grid img {
            width: 100%;
            height: 160px;
            border-radius: 10px;
            border: 1px solid #3f3f46;
            object-fit: cover;
          }
          @media print {
            body {
              background-color: #09090b !important;
              color: #f4f4f5 !important;
              padding: 15px;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="no-print">
            <strong>💡 Dica:</strong> Na caixa de impressão, certifique-se de selecionar <strong>"Salvar como PDF"</strong> e marque <strong>"Gráficos em segundo plano"</strong> para preservar o fundo escuro do site.
          </div>

          <div class="header-card">
            <h1>🎮 ${game.name}</h1>
            <div class="meta-grid">
              <span class="meta-item">💻 <strong>Plataforma:</strong> ${game.platform}</span>
              ${game.rating ? `<span class="meta-item">⭐ <strong>Nota:</strong> ${game.rating}/5</span>` : ""}
              ${game.playtime ? `<span class="meta-item">⏱️ <strong>Tempo:</strong> ${game.playtime}</span>` : ""}
            </div>
            <div>
              ${(Array.isArray(game.status) ? game.status : typeof game.status === "string" ? [game.status] : []).map((s) => '<span class="badge">' + s + '</span>').join("")}
            </div>
          </div>

          <div class="section-title">📖 Diário da Jornada</div>
          ${
            game.diary && game.diary.length > 0
              ? game.diary
                  .map(
                    (entry, idx) => {
                      const formattedText = cleanHTMLText(applyDictionaryToHtml(entry.text, game.dictionary).updatedHtml);
                      return `
              <div class="entry-card">
                <div class="entry-title">Registro ${idx + 1} (${entry.period || "Sem Data"})</div>
                ${
                  entry.keyMoments && entry.keyMoments.length > 0
                    ? `<div style="margin-bottom: 10px;">${entry.keyMoments
                        .map((km) => `<span class="badge" style="background: #1e1b4b; border-color: #4338ca; color: #a5b4fc;">${km}</span>`)
                        .join("")}</div>`
                    : ""
                }
                <div class="entry-text">${formattedText}</div>
                ${
                  entry.medias && entry.medias.filter((m) => !m.isVideo).length > 0
                    ? `<div class="media-grid">
                        ${entry.medias
                          .filter((m) => !m.isVideo)
                          .map((m) => `<img src="${m.src}" alt="Mídia do diário" />`)
                          .join("")}
                       </div>`
                    : ""
                }
              </div>
            `;
                    }
                  )
                  .join("")
              : "<p style='color: #71717a;'>Nenhuma entrada de diário registrada para este jogo.</p>"
          }
        </div>
        <script>
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
