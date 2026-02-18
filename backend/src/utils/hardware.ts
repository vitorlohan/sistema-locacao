// ============================================================
// sistema-locacao — Hardware Fingerprint Collection
// Coleta dados detalhados do hardware para vinculação de licença
// ============================================================
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

export interface HardwareInfo {
  cpu_id: string;
  cpu_model: string;
  cpu_cores: number;
  disk_serial: string;
  mac_addresses: string[];
  hostname: string;
  username: string;
  platform: string;
  arch: string;
  total_memory: string;
  machine_id: string;        // Hash combinado de todos os dados
  raw_fingerprint: string;   // Dados brutos usados no hash
}

/**
 * Tenta obter o serial do processador via PowerShell (Windows)
 * Usa Get-CimInstance em vez de WMIC (descontinuado no Windows 11+)
 */
function getCpuId(): string {
  try {
    if (process.platform === 'win32') {
      // PowerShell Get-CimInstance (funciona em todas as versões do Windows 10/11)
      const result = execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).ProcessorId"',
        { encoding: 'utf-8', timeout: 10000, windowsHide: true },
      );
      const id = result.trim();
      if (id && id !== '' && !id.includes('Error')) return id;
    }
  } catch { /* silently fail */ }
  
  // Fallback: usa o modelo + features da CPU
  const cpus = os.cpus();
  if (cpus.length > 0) {
    return crypto.createHash('md5').update(cpus[0].model + cpus.length).digest('hex').substring(0, 16).toUpperCase();
  }
  return 'UNKNOWN';
}

/**
 * Tenta obter o serial do disco principal via PowerShell (Windows)
 * Usa Get-CimInstance em vez de WMIC (descontinuado no Windows 11+)
 */
function getDiskSerial(): string {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber"',
        { encoding: 'utf-8', timeout: 10000, windowsHide: true },
      );
      const serial = result.trim();
      if (serial && serial !== '' && !serial.includes('Error')) return serial;
    }
  } catch { /* silently fail */ }

  try {
    if (process.platform === 'win32') {
      // Alternativa: Serial do volume C:
      const result = execSync('vol C:', {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
      });
      const match = result.match(/([A-F0-9]{4}-[A-F0-9]{4})/i);
      if (match) return match[1].trim();
    }
  } catch { /* silently fail */ }

  return 'UNKNOWN';
}

/**
 * Coleta todos os MAC addresses reais (exclui loopback e virtuais)
 */
function getMacAddresses(): string[] {
  const macs: string[] = [];
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets).sort()) {
    const ifaces = nets[name];
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (
        !iface.internal &&
        iface.mac &&
        iface.mac !== '00:00:00:00:00:00' &&
        !macs.includes(iface.mac)
      ) {
        macs.push(iface.mac);
      }
    }
  }

  return macs;
}

/**
 * Gera um ID único da máquina baseado em:
 * CPU ID + Disk Serial + MAC Addresses + Hostname + Username
 */
function generateMachineId(info: Omit<HardwareInfo, 'machine_id' | 'raw_fingerprint'>): { machineId: string; rawFingerprint: string } {
  const parts = [
    info.cpu_id,
    info.disk_serial,
    ...info.mac_addresses,
    info.hostname,
    info.platform,
    info.arch,
  ];

  const rawFingerprint = parts.join('|');
  const machineId = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

  return { machineId, rawFingerprint };
}

/**
 * Coleta todas as informações de hardware da máquina.
 * Retorna um objeto com dados detalhados + hash identificador.
 */
export function collectHardwareInfo(): HardwareInfo {
  const cpu_id = getCpuId();
  const cpu_model = os.cpus()[0]?.model || 'Unknown';
  const cpu_cores = os.cpus().length;
  const disk_serial = getDiskSerial();
  const mac_addresses = getMacAddresses();
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const platform = os.platform();
  const arch = os.arch();
  const total_memory = `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`;

  const partialInfo = {
    cpu_id,
    cpu_model,
    cpu_cores,
    disk_serial,
    mac_addresses,
    hostname,
    username,
    platform,
    arch,
    total_memory,
  };

  const { machineId, rawFingerprint } = generateMachineId(partialInfo);

  return {
    ...partialInfo,
    machine_id: machineId,
    raw_fingerprint: rawFingerprint,
  };
}
