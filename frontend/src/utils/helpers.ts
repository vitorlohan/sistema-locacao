export function fmtCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Parse a date string without timezone conversion (treat as Brasilia local time) */
function parseLocal(iso: string): Date {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" — treat as local
  const s = iso.replace(' ', 'T');
  const parts = s.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/);
  if (!parts) return new Date(iso);
  return new Date(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5], +(parts[6] || 0));
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  const d = parseLocal(iso);
  return d.toLocaleDateString('pt-BR');
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = parseLocal(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function toInputDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function toInputDateTime(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

export const RENTAL_PERIOD_LABELS: Record<string, string> = {
  hour: 'Hora',
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
};

export const ITEM_STATUS_LABELS: Record<string, string> = {
  available: 'Disponível',
  rented: 'Alugado',
  maintenance: 'Manutenção',
};

export const RENTAL_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  overdue: 'Atrasado',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  pix: 'PIX',
  transfer: 'Transferência',
  other: 'Outro',
};

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'available': case 'active': case 'completed': case 'open': return 'badge-success';
    case 'rented': case 'closed': return 'badge-info';
    case 'maintenance': case 'overdue': return 'badge-warning';
    case 'cancelled': return 'badge-danger';
    default: return 'badge-gray';
  }
}

export function generateReceipt(rental: {
  id: number;
  client_name: string;
  child_name?: string | null;
  item_name: string;
  item_code: string;
  start_date: string;
  expected_end_date: string;
  actual_end_date?: string | null;
  rental_value: number;
  deposit: number;
  discount: number;
  late_fee: number;
  total_value: number;
  total_paid: number;
  status: string;
  observations?: string;
}): void {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const remaining = rental.total_value - rental.total_paid;

  // Calculate elapsed time
  let elapsedStr = '';
  if (rental.actual_end_date) {
    const start = new Date(rental.start_date.replace(' ', 'T'));
    const end = new Date(rental.actual_end_date.replace(' ', 'T'));
    const diffMs = end.getTime() - start.getTime();
    const totalMin = Math.max(0, Math.floor(diffMs / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const s = Math.floor((diffMs % 60000) / 1000);
    elapsedStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recibo #${rental.id}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm 3mm;
      font-size: 12px;
      line-height: 1.4;
      color: #000;
      -webkit-print-color-adjust: exact;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; }
    .row .label { flex: 1; }
    .row .value { text-align: right; white-space: nowrap; }
    .title { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
    .big-total { font-size: 16px; font-weight: bold; }
    .small { font-size: 10px; color: #333; }
    .status-paid { font-weight: bold; }
    @media print { body { padding: 2mm; } }
    @media screen { body { border: 1px solid #ccc; margin: 20px auto; padding: 8mm 5mm; } }
  </style>
</head>
<body>
  <div class="center title">RECIBO DE LOCAÇÃO</div>
  <div class="center small">Documento não fiscal</div>
  <div class="divider"></div>

  <div class="center bold">Nº ${String(rental.id).padStart(6, '0')}</div>
  <div class="center small">${dateStr}</div>
  <div class="divider"></div>

  <div class="bold">RESPONSÁVEL</div>
  <div>${rental.client_name}</div>
  ${rental.child_name ? `<div>Criança: ${rental.child_name}</div>` : ''}
  <div class="divider"></div>

  <div class="bold">ITEM</div>
  <div>${rental.item_name}</div>
  <div class="small">Cód: ${rental.item_code}</div>
  <div class="divider"></div>

  <div class="bold">PERÍODO</div>
  <div class="row"><span class="label">Início:</span><span class="value">${fmtDateTime(rental.start_date)}</span></div>
  <div class="row"><span class="label">Prev. Dev.:</span><span class="value">${fmtDateTime(rental.expected_end_date)}</span></div>
  ${rental.actual_end_date ? `<div class="row"><span class="label">Devolução:</span><span class="value">${fmtDateTime(rental.actual_end_date)}</span></div>` : ''}
  ${elapsedStr ? `<div class="row"><span class="label">Permanência:</span><span class="value">${elapsedStr}</span></div>` : ''}
  <div class="divider"></div>

  <div class="bold">VALORES</div>
  <div class="row"><span class="label">Locação</span><span class="value">${fmtCurrency(rental.rental_value)}</span></div>
  ${rental.discount > 0 ? `<div class="row"><span class="label">Desconto</span><span class="value">- ${fmtCurrency(rental.discount)}</span></div>` : ''}
  ${rental.late_fee > 0 ? `<div class="row"><span class="label">Multa Atraso</span><span class="value">+ ${fmtCurrency(rental.late_fee)}</span></div>` : ''}
  ${rental.deposit > 0 ? `<div class="row"><span class="label">Caução</span><span class="value">${fmtCurrency(rental.deposit)}</span></div>` : ''}
  <div class="double-divider"></div>

  <div class="row big-total"><span class="label">TOTAL</span><span class="value">${fmtCurrency(rental.total_value)}</span></div>
  <div class="divider"></div>

  <div class="row"><span class="label">Pago</span><span class="value status-paid">${fmtCurrency(rental.total_paid)}</span></div>
  ${remaining > 0 ? `<div class="row"><span class="label">Restante</span><span class="value" style="font-weight:bold">${fmtCurrency(remaining)}</span></div>` : ''}
  ${remaining <= 0 ? '<div class="center bold" style="margin-top:4px">*** PAGO ***</div>' : ''}
  <div class="divider"></div>

  <div class="row small"><span class="label">Status:</span><span class="value">${RENTAL_STATUS_LABELS[rental.status] || rental.status}</span></div>
  ${rental.observations ? `<div style="margin-top:4px" class="small">Obs: ${rental.observations}</div>` : ''}
  <div class="divider"></div>

  <div class="center small" style="margin-top:6px">Documento gerado pelo sistema</div>
  <div class="center small">Obrigado pela preferência!</div>
  <div style="margin-top:12px"></div>
</body>
</html>
  `.trim();

  // Use iframe approach that works in Electron (window.open is blocked)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to render, then print
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // Fallback: show in a blob URL opened in same window
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      // Remove iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 500);
  }
}
