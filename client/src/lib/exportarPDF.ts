import type { Despesa } from "../api/client";
import { formatarData, formatarEuros, formatarMes } from "./format";

// Cores da marca ScanWise
const MARINHO: [number, number, number] = [28, 56, 86]; // #1c3856
const TEAL: [number, number, number] = [52, 125, 142]; // #347d8e
const CINZA: [number, number, number] = [100, 116, 139];

interface Opcoes {
  mes: string; // YYYY-MM
  nomeGrupo: string;
  despesas: Despesa[];
  solo: boolean;
}

const eur = (centimos: number) => formatarEuros(centimos);

// Gera e descarrega o relatório de despesas do mês em PDF.
export async function exportarMesPDF({ mes, nomeGrupo, despesas, solo }: Opcoes) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14; // margem
  const larguraTexto = doc.internal.pageSize.getWidth() - M * 2;

  // ── Cabeçalho com branding ──
  const logo = await carregarLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M, 12, 20, 12);
    } catch {
      /* ignora logo inválido */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...MARINHO);
  doc.text("ScanWise", M + 24, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  doc.text("Relatório de despesas", M + 24, 23);

  doc.setFontSize(13);
  doc.setTextColor(...MARINHO);
  doc.setFont("helvetica", "bold");
  doc.text(formatarMes(mes), doc.internal.pageSize.getWidth() - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  doc.text(nomeGrupo, doc.internal.pageSize.getWidth() - M, 23, { align: "right" });

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(M, 27, M + larguraTexto, 27);

  // ── Totais ──
  const total = despesas.reduce((s, d) => s + d.valor_centimos, 0);
  const ivaTotal = despesas.reduce((s, d) => s + (d.iva_centimos ?? 0), 0);
  const comIva = despesas.some((d) => d.iva_centimos != null);

  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const resumoLinha = `Total do mês: ${eur(total)}    ·    ${despesas.length} ${
    despesas.length === 1 ? "despesa" : "despesas"
  }${comIva ? `    ·    IVA: ${eur(ivaTotal)}` : ""}`;
  doc.text(resumoLinha, M, 35);

  let y = 42;

  // ── Por categoria ──
  const porCategoria = agrupar(despesas, (d) => d.categoria_nome ?? "Sem categoria");
  autoTable(doc, {
    startY: tituloSecao(doc, "Por categoria", y),
    head: [["Categoria", "Total", "%"]],
    body: porCategoria.map(([nome, v]) => [
      nome,
      eur(v),
      total > 0 ? `${Math.round((v / total) * 100)}%` : "0%",
    ]),
    ...estiloTabela(),
  });
  y = depoisDe(doc);

  // ── Por pessoa (só em grupo) ──
  if (!solo) {
    const porPessoa = agrupar(despesas, (d) => d.membro_nome ?? "Sem pessoa");
    autoTable(doc, {
      startY: tituloSecao(doc, "Por pessoa", y),
      head: [["Pessoa", "Total", "%"]],
      body: porPessoa.map(([nome, v]) => [
        nome,
        eur(v),
        total > 0 ? `${Math.round((v / total) * 100)}%` : "0%",
      ]),
      ...estiloTabela(),
    });
    y = depoisDe(doc);
  }

  // ── Lista de despesas (IVA discriminado por linha) ──
  const linhas = [...despesas].sort((a, b) => (a.data < b.data ? 1 : -1));
  const colPessoa = !solo;

  const head = ["Data", "Descrição", "Categoria"];
  if (colPessoa) head.push("Quem pagou");
  head.push("IVA", "Valor");

  const body = linhas.map((d) => {
    const linha = [formatarData(d.data), d.descricao || "—", d.categoria_nome ?? "—"];
    if (colPessoa) linha.push(d.membro_nome ?? "—");
    linha.push(d.iva_centimos != null ? eur(d.iva_centimos) : "—", eur(d.valor_centimos));
    return linha;
  });

  const nCols = head.length;
  const footRow = new Array(nCols).fill("");
  footRow[nCols - 3] = "Total";
  footRow[nCols - 2] = comIva ? eur(ivaTotal) : "—";
  footRow[nCols - 1] = eur(total);

  autoTable(doc, {
    startY: tituloSecao(doc, "Despesas", y),
    head: [head],
    body,
    foot: [footRow],
    ...estiloTabela(),
    columnStyles: {
      [nCols - 2]: { halign: "right" }, // IVA
      [nCols - 1]: { halign: "right", fontStyle: "bold" }, // Valor
    },
  });

  // ── Rodapé em todas as páginas ──
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text("Gerado por ScanWise", M, h - 8);
    doc.text(`Página ${p}/${paginas}`, doc.internal.pageSize.getWidth() - M, h - 8, {
      align: "right",
    });
  }

  doc.save(`ScanWise-${mes}.pdf`);
}

// ── Auxiliares ──
function agrupar(despesas: Despesa[], chave: (d: Despesa) => string): Array<[string, number]> {
  const mapa = new Map<string, number>();
  for (const d of despesas) mapa.set(chave(d), (mapa.get(chave(d)) ?? 0) + d.valor_centimos);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

function estiloTabela() {
  return {
    theme: "striped" as const,
    headStyles: { fillColor: MARINHO, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    footStyles: { fillColor: [238, 241, 246] as [number, number, number], textColor: MARINHO, fontStyle: "bold" as const },
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" as const },
    alternateRowStyles: { fillColor: [245, 247, 250] as [number, number, number] },
    margin: { top: 16, left: 14, right: 14 },
    showHead: "everyPage" as const, // cabeçalho repete no topo de cada página
    showFoot: "lastPage" as const, // linha de Total só na última página
  };
}

// Desenha o título da secção em y e devolve o y onde a tabela deve começar.
function tituloSecao(doc: any, titulo: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text(titulo, 14, y);
  doc.setFont("helvetica", "normal");
  return y + 2;
}

function depoisDe(doc: any): number {
  return (doc.lastAutoTable?.finalY ?? 40) + 10;
}

// Carrega o logótipo já REDUZIDO (downscale via canvas) para o PDF não ficar
// pesado — a ~160px de largura chega para o cabeçalho e baixa de ~1 MB para ~100 KB.
async function carregarLogo(): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = "/logo.png";
    });
    const w = 160;
    const h = Math.round((img.naturalHeight / Math.max(img.naturalWidth, 1)) * w) || 96;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
