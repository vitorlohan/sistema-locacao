import QRCode from 'qrcode';

/**
 * Generates a PIX BR Code payload (Static QR Code) following the EMV QRCPS standard.
 * Reference: BACEN PIX specification for static QR codes.
 */

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  // CRC-16/CCITT-FALSE used by PIX
  const data = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(payload) : payload.split('').map((c) => c.charCodeAt(0));
  let crc = 0xffff;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixConfig {
  /** PIX key (CPF, CNPJ, email, phone, or random key) */
  pixKey: string;
  /** Key type: cpf, cnpj, email, phone, random */
  pixKeyType: string;
  /** Merchant/business name (max 25 chars) */
  merchantName: string;
  /** City (max 15 chars) */
  merchantCity: string;
}

/**
 * Build a PIX static QR code payload string.
 */
export function buildPixPayload(config: PixConfig, amount: number, txId?: string): string {
  // Payload Format Indicator
  let payload = tlv('00', '01');
  
  // Merchant Account Information (PIX)
  // GUI = br.gov.bcb.pix
  const gui = tlv('00', 'br.gov.bcb.pix');
  const key = tlv('01', config.pixKey);
  payload += tlv('26', gui + key);
  
  // Merchant Category Code
  payload += tlv('52', '0000');
  
  // Transaction Currency (986 = BRL)
  payload += tlv('53', '986');
  
  // Transaction Amount
  if (amount > 0) {
    payload += tlv('54', amount.toFixed(2));
  }
  
  // Country Code
  payload += tlv('58', 'BR');
  
  // Merchant Name
  payload += tlv('59', config.merchantName.substring(0, 25));
  
  // Merchant City
  payload += tlv('60', config.merchantCity.substring(0, 15));
  
  // Additional Data Field Template (txid)
  if (txId) {
    const txIdField = tlv('05', txId.substring(0, 25));
    payload += tlv('62', txIdField);
  }
  
  // CRC16 placeholder + calculation
  payload += '6304';
  const checksum = crc16(payload);
  payload += checksum;
  
  return payload;
}

/**
 * Generate PIX QR Code as a data URL (base64 PNG image).
 */
export async function generatePixQRCode(
  config: PixConfig,
  amount: number,
  txId?: string
): Promise<string> {
  const payload = buildPixPayload(config, amount, txId);
  const dataUrl = await QRCode.toDataURL(payload, {
    width: 280,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
  return dataUrl;
}

/**
 * Copy PIX payload to clipboard (Pix Copia e Cola).
 */
export function copyPixPayload(config: PixConfig, amount: number, txId?: string): string {
  const payload = buildPixPayload(config, amount, txId);
  navigator.clipboard?.writeText(payload);
  return payload;
}
