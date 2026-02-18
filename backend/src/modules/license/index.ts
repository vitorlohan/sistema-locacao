// ============================================================
// sistema-locacao — License Module
// Integrates key-license-manager client SDK + hardware fingerprint
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import {
  validateLicense,
  getLicenseInfo,
  getMachineId,
  getHostname,
  LicenseStorage,
} from 'key-license-manager';
import type { LicensePlan } from 'key-license-manager';
import config from '../../config';
import { collectHardwareInfo } from '../../utils/hardware';

const router = Router();

// -------  Helpers  -------

function getOptions() {
  return {
    secret: config.license.secret,
    storagePath: config.license.storagePath,
  };
}

/**
 * Retorna o machine_id do SDK (usado para salvar/validar .license).
 * IMPORTANTE: usar SEMPRE este para consistência com o arquivo local.
 */
function getConsistentMachineId(): string {
  return getMachineId();
}

// -------  Online Validation Cache  -------

interface OnlineCheckResult {
  valid: boolean;
  reason?: string;
  checkedAt: number;
}

const ONLINE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
let lastOnlineCheck: OnlineCheckResult | null = null;

/**
 * Verifica a licença ONLINE contra o servidor central-licencas.
 * Retorna o resultado cacheado se ainda estiver dentro do intervalo.
 * Se não conseguir conectar → permite offline (licença local válida é suficiente).
 */
async function checkLicenseOnline(): Promise<OnlineCheckResult> {
  // Se o cache ainda é válido, retorna direto
  if (lastOnlineCheck && (Date.now() - lastOnlineCheck.checkedAt) < ONLINE_CHECK_INTERVAL_MS) {
    return lastOnlineCheck;
  }

  try {
    const info = getLicenseInfo(getOptions());
    if (!info.activated || !info.key) {
      lastOnlineCheck = { valid: false, reason: 'Licença não ativada.', checkedAt: Date.now() };
      return lastOnlineCheck;
    }

    // IMPORTANTE: usar o MESMO machineId que foi salvo no .license (SDK getMachineId)
    const machineId = getConsistentMachineId();
    const hwInfo = collectHardwareInfo();
    const serverUrl = config.license.serverUrl.replace(/\/$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${serverUrl}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: info.key,
        machine_id: machineId, // CORRIGIDO: usar SDK machineId (consistente com .license)
        hardware: {
          cpu_id: hwInfo.cpu_id,
          cpu_model: hwInfo.cpu_model,
          cpu_cores: hwInfo.cpu_cores,
          disk_serial: hwInfo.disk_serial,
          mac_addresses: hwInfo.mac_addresses,
          hostname: hwInfo.hostname,
          username: hwInfo.username,
          platform: hwInfo.platform,
          arch: hwInfo.arch,
          total_memory: hwInfo.total_memory,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      lastOnlineCheck = { valid: false, reason: 'Servidor de licenças retornou erro.', checkedAt: Date.now() };
      return lastOnlineCheck;
    }

    const data = await response.json() as { valid: boolean; message?: string; error?: string };
    lastOnlineCheck = {
      valid: data.valid,
      reason: data.valid ? undefined : (data.error || data.message || 'Licença inválida no servidor.'),
      checkedAt: Date.now(),
    };
    return lastOnlineCheck;
  } catch (err: any) {
    // Sem internet ou servidor fora → permite offline (licença local já foi validada)
    lastOnlineCheck = {
      valid: true,
      reason: undefined,
      checkedAt: Date.now(),
    };
    return lastOnlineCheck;
  }
}

/** Força revalidação online (invalida cache) */
export function invalidateOnlineCache(): void {
  lastOnlineCheck = null;
}

// -------  Middleware  -------

/**
 * Middleware que verifica se o sistema está licenciado.
 * 1. Valida o arquivo local (.license) — offline
 * 2. Valida ONLINE contra o servidor central (se possível, não bloqueia offline)
 * Bloqueia se não houver licença local válida. Funciona offline após ativação.
 */
export function licenseGuard(req: Request, res: Response, next: NextFunction): void {
  // Em desenvolvimento, pula verificação de licença
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_LICENSE !== 'false') {
    next();
    return;
  }

  // Permite rotas que NÃO são /api/ — SPA precisa carregar livremente
  // (ex: /ativar, /login, / são servidas pelo SPA fallback)
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/api')) {
    next();
    return;
  }

  // Permite rotas de licença e health sempre
  if (req.path.startsWith('/api/license') || req.path === '/api/health') {
    next();
    return;
  }

  // 1. Verificação local (arquivo .license)
  const localResult = validateLicense(getOptions());
  if (!localResult.valid) {
    res.status(403).json({
      error: true,
      licensed: false,
      message: 'Sistema não licenciado',
      reason: localResult.reason,
    });
    return;
  }

  // 2. Verificação online (não-bloqueante — funciona offline após ativação)
  checkLicenseOnline()
    .then((onlineResult) => {
      if (!onlineResult.valid) {
        // Se a verificação online diz que é inválido, bloqueia
        res.status(403).json({
          error: true,
          licensed: false,
          message: 'Licença não verificada online',
          reason: onlineResult.reason,
        });
        return;
      }
      next();
    })
    .catch(() => {
      // Falha de rede → permite continuar (licença local já foi validada)
      next();
    });
}

// -------  Routes  -------

/** GET /api/license/status — verificar estado da licença */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const info = getLicenseInfo(getOptions());
    const maskKey = (k: string) => {
      if (k.length <= 9) return k;
      const parts = k.split('-');
      return parts.map((p, i) => (i === 0 || i === parts.length - 1) ? p : '****').join('-');
    };
    res.json({
      licensed: info.activated,
      key: info.key ? maskKey(info.key) : null,
      plan: info.plan || null,
      product: info.product || null,
      activatedAt: info.activatedAt || null,
      expiresAt: info.expiresAt || null,
      machineId: info.machineId ? info.machineId.substring(0, 12) + '...' : null,
    });
  } catch {
    res.json({ licensed: false });
  }
});

/**
 * POST /api/license/activate — ativar licença
 *
 * NÃO usa activateLicense() do SDK pois:
 *  - SDK regex só aceita 4 blocos (server gera 5)
 *  - SDK envia machineId (camelCase), server espera machine_id (snake_case)
 *  - SDK espera { success, message, license: {..., signature} }, server retorna { activation, license }
 *
 * Solução: fazer a chamada HTTP diretamente e salvar com LicenseStorage do SDK.
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const { key } = req.body;

    if (!key || typeof key !== 'string') {
      res.status(400).json({ success: false, message: 'Chave é obrigatória.' });
      return;
    }

    // Validar formato (aceita 4 ou 5 blocos)
    const normalized = key.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3,4}$/.test(normalized)) {
      res.status(400).json({ success: false, message: 'Formato inválido. Use XXXX-XXXX-XXXX-XXXX ou XXXX-XXXX-XXXX-XXXX-XXXX.' });
      return;
    }

    // Usar o MESMO machineId que o SDK usa para validação local
    const machineId = getConsistentMachineId();
    const hostname = getHostname();
    const hwInfo = collectHardwareInfo();

    const serverUrl = config.license.serverUrl.replace(/\/$/, '');

    // 1. Chamar central-licencas diretamente (enviando machine_id em snake_case)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${serverUrl}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: normalized,
        machine_id: machineId, // snake_case — como o servidor espera
        hostname,
        hardware: {
          cpu_id: hwInfo.cpu_id,
          cpu_model: hwInfo.cpu_model,
          cpu_cores: hwInfo.cpu_cores,
          disk_serial: hwInfo.disk_serial,
          mac_addresses: hwInfo.mac_addresses,
          username: hwInfo.username,
          platform: hwInfo.platform,
          arch: hwInfo.arch,
          total_memory: hwInfo.total_memory,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const body = await response.json() as any;

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message: body.error || body.message || 'Falha na ativação.',
      });
      return;
    }

    // 2. Resposta do central-licencas: { activation, license }
    //    Precisamos converter para o formato do LicenseStorage do SDK
    const serverLicense = body.license;
    if (!serverLicense) {
      res.status(400).json({ success: false, message: 'Resposta do servidor não contém dados da licença.' });
      return;
    }

    // 3. Salvar licença localmente usando LicenseStorage (criptografada + HMAC)
    const storage = new LicenseStorage(config.license.secret, config.license.storagePath);
    storage.save({
      key: normalized,
      plan: (serverLicense.plan || 'basic') as LicensePlan,
      product: serverLicense.product || 'sistema-locacao',
      machineId, // MESMO machineId do SDK — vai bater na validação local
      activatedAt: body.activation?.activated_at || new Date().toISOString(),
      expiresAt: serverLicense.expires_at || null,
    });

    // 4. Invalida cache online para forçar nova verificação
    invalidateOnlineCache();

    // 5. Confirma leitura do que foi salvo
    const info = getLicenseInfo(getOptions());

    res.json({
      success: true,
      message: 'Licença ativada com sucesso!',
      license: {
        plan: info.plan || serverLicense.plan,
        product: info.product || serverLicense.product,
        activatedAt: info.activatedAt || body.activation?.activated_at,
        expiresAt: info.expiresAt || serverLicense.expires_at,
      },
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      res.status(504).json({ success: false, message: 'Timeout ao conectar ao servidor de licenças.' });
      return;
    }
    console.error('[License] Erro na ativação:', err);
    res.status(500).json({ success: false, message: err.message || 'Erro interno na ativação.' });
  }
});

/** GET /api/license/machine — informações detalhadas da máquina */
router.get('/machine', (_req: Request, res: Response) => {
  try {
    const hwInfo = collectHardwareInfo();
    const sdkMachineId = getConsistentMachineId();
    res.json({
      machineId: sdkMachineId,
      hostname: getHostname(),
      hardware: {
        cpu_id: hwInfo.cpu_id,
        cpu_model: hwInfo.cpu_model,
        cpu_cores: hwInfo.cpu_cores,
        disk_serial: hwInfo.disk_serial,
        mac_addresses: hwInfo.mac_addresses,
        hostname: hwInfo.hostname,
        username: hwInfo.username,
        platform: hwInfo.platform,
        arch: hwInfo.arch,
        total_memory: hwInfo.total_memory,
        machine_id: sdkMachineId,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: true, message: err.message });
  }
});

/** GET /api/license/validate — validação detalhada */
router.get('/validate', (_req: Request, res: Response) => {
  const result = validateLicense(getOptions());
  res.json({
    valid: result.valid,
    reason: result.reason || null,
  });
});

export const licenseRoutes = router;
