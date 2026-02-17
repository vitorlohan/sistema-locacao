/**
 * Serviço de exportação de relatórios — PDF e CSV.
 * PDF gerado com PDFKit, CSV gerado manualmente.
 */
import PDFDocument from 'pdfkit';

// ─── CSV ─────────────────────────────────────────────────

interface CsvOptions {
  columns: { key: string; header: string; format?: (val: any) => string }[];
  data: any[];
  title?: string;
}

export function generateCsv(options: CsvOptions): string {
  const { columns, data, title } = options;
  const lines: string[] = [];

  if (title) {
    lines.push(title);
    lines.push('');
  }

  // Header row
  lines.push(columns.map((c) => escapeCsv(c.header)).join(';'));

  // Data rows
  for (const row of data) {
    const values = columns.map((col) => {
      const raw = row[col.key];
      const formatted = col.format ? col.format(raw) : String(raw ?? '');
      return escapeCsv(formatted);
    });
    lines.push(values.join(';'));
  }

  return '\uFEFF' + lines.join('\r\n'); // BOM for UTF-8 Excel compatibility
}

function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── PDF ─────────────────────────────────────────────────

interface PdfTableColumn {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  format?: (val: any) => string;
}

interface PdfOptions {
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  data: any[];
  summary?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
}

export function generatePdf(options: PdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { title, subtitle, columns, data, summary, orientation } = options;
    const isLandscape = orientation === 'landscape';

    const doc = new PDFDocument({
      size: 'A4',
      layout: isLandscape ? 'landscape' : 'portrait',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
      info: {
        Title: title,
        Author: 'Sistema de Locação',
        Creator: 'Sistema de Locação',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = isLandscape ? 841.89 - 80 : 595.28 - 80; // A4 minus margins

    // ── Header ──
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('SISTEMA DE LOCAÇÃO', { align: 'center' });

    doc.moveDown(0.3);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), { align: 'center' });

    if (subtitle) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(subtitle, { align: 'center' });
    }

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.moveDown(0.8);

    // ── Summary box (if provided) ──
    if (summary && summary.length > 0) {
      const boxY = doc.y;
      doc
        .rect(40, boxY, pageWidth, summary.length * 16 + 16)
        .fill('#f5f5f5');

      doc.fill('#333333');
      let sy = boxY + 8;
      for (const item of summary) {
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(item.label + ': ', 50, sy, { continued: true })
          .font('Helvetica')
          .text(item.value);
        sy += 16;
      }
      doc.y = boxY + summary.length * 16 + 24;
    }

    // ── Table ──
    if (columns.length > 0 && data.length > 0) {
      drawTable(doc, columns, data, pageWidth);
    } else if (data.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Nenhum registro encontrado.', { align: 'center' });
    }

    // ── Footer on each page ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .font('Helvetica')
        .text(
          `Página ${i + 1} de ${totalPages}`,
          40,
          isLandscape ? 555 : 800,
          { align: 'center', width: pageWidth }
        );
    }

    doc.end();
  });
}

function drawTable(doc: PDFKit.PDFDocument, columns: PdfTableColumn[], data: any[], pageWidth: number): void {
  const rowHeight = 18;
  const headerHeight = 22;
  const startX = 40;
  const maxY = doc.page.height - 60;

  // ── Header row ──
  function drawHeader(y: number): void {
    doc
      .rect(startX, y, pageWidth, headerHeight)
      .fill('#2c3e50');

    let x = startX + 4;
    doc.fill('#ffffff').fontSize(8).font('Helvetica-Bold');
    for (const col of columns) {
      doc.text(col.header, x, y + 6, {
        width: col.width - 8,
        align: col.align || 'left',
      });
      x += col.width;
    }

    doc.fill('#333333');
  }

  drawHeader(doc.y);
  let currentY = doc.y + headerHeight;

  // ── Data rows ──
  for (let i = 0; i < data.length; i++) {
    if (currentY + rowHeight > maxY) {
      doc.addPage();
      currentY = 40;
      drawHeader(currentY);
      currentY += headerHeight;
    }

    // Alternating row colors
    if (i % 2 === 0) {
      doc
        .rect(startX, currentY, pageWidth, rowHeight)
        .fill('#fafafa');
      doc.fill('#333333');
    }

    let x = startX + 4;
    doc.fontSize(8).font('Helvetica');
    for (const col of columns) {
      const raw = data[i][col.key];
      const text = col.format ? col.format(raw) : String(raw ?? '-');
      doc.text(text, x, currentY + 4, {
        width: col.width - 8,
        align: col.align || 'left',
      });
      x += col.width;
    }

    currentY += rowHeight;
  }

  // Bottom line
  doc
    .moveTo(startX, currentY)
    .lineTo(startX + pageWidth, currentY)
    .stroke('#cccccc');

  doc.y = currentY + 8;

  // Row count
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(`Total de registros: ${data.length}`, { align: 'right' });
}

// ─── Helper: currency format ────────────────────────────

export function fmtCurrency(value: any): string {
  const n = typeof value === 'number' ? value : parseFloat(value) || 0;
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}

export function fmtDate(value: any): string {
  if (!value) return '-';
  const str = String(value);
  // Handle ISO dates and SQLite dates
  if (str.length >= 10) {
    const [y, m, d] = str.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
}
