// ============================================================
// sistema-locacao — License Module
// Integrates key-license-manager client SDK + hardware fingerprint
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import {
  validateLicense,
  isActivated,
  activateLicense,
  getLicenseInfo,
  getMachineId,
  getHostname,
} from 'key-license-manager';
import config from '../../config';
import { collectHardwareInfo, type HardwareInfo } from '../../utils/hardware';

const router = Router();

// -------  Helpers  -------

function getOptions() {
  return {
    secret: config.license.secret,
    storagePath: config.license.storagePath,
  };
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

    const machineId = getMachineId();
    const hwInfo = collectHardwareInfo();
    const serverUrl = config.license.serverUrl.replace(/\/$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(`${serverUrl}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: info.key,
        machine_id: hwInfo.machine_id,
        hostname: hwInfo.hostname,
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

    clearTimeout(timeout);

    if (!response.ok) {
      lastOnlineCheck = { valid: false, reason: 'Servidor de licenças retornou erro.', checkedAt: Date.now() };
      return lastOnlineCheck;
    }

    const data = await response.json() as { valid: boolean; message?: string };
    lastOnlineCheck = {
      valid: data.valid,
      reason: data.valid ? undefined : (data.message || 'Licença inválida no servidor.'),
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
 * 2. Valida ONLINE contra o servidor central (se possível)
 * Bloqueia se não houver licença local válida. Funciona offline após ativação.
 */
export function licenseGuard(req: Request, res: Response, next: NextFunction): void {
  // Em desenvolvimento, pula verificação de licença
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_LICENSE !== 'false') {
    next();
    return;
  }

  // Permite rotas de licença sempre
  if (req.path.startsWith('/api/license')) {
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

  // 2. Verificação online (obrigatória — sem internet = bloqueado)
  checkLicenseOnline()
    .then((onlineResult) => {
      if (!onlineResult.valid) {
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
      res.status(403).json({
        error: true,
        licensed: false,
        message: 'Falha na verificação de licença',
        reason: 'Sem conexão com o servidor de licenças.',
      });
    });
}

// -------  Routes  -------

/** GET /api/license/status — verificar estado da licença */
router.get('/status', (_req: Request, res: Response) => {
  try {
    const info = getLicenseInfo(getOptions());
    res.json({
      licensed: info.activated,
      key: info.key ? `${info.key.substring(0, 4)}-****-****-${info.key.substring(15)}` : null,
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

/** POST /api/license/activate — ativar licença */
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
      res.status(400).json({ success: false, message: 'Formato inválido. Use XXXX-XXXX-XXXX-XXXX-XXXX.' });
      return;
    }

    // Coletar dados de hardware detalhados
    const hwInfo = collectHardwareInfo();

    const result = await activateLicense(normalized, {
      serverUrl: config.license.serverUrl,
      secret: config.license.secret,
      storagePath: config.license.storagePath,
      timeout: 15000,
    });

    // Enviar dados de hardware para o central-licencas (fire-and-forget)
    try {
      const serverUrl = config.license.serverUrl.replace(/\/$/, '');
      await fetch(`${serverUrl}/api/activate/hardware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: normalized,
          machine_id: hwInfo.machine_id,
          hostname: hwInfo.hostname,
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
      });
    } catch { /* silently fail — não bloqueia ativação */ }

    if (result.success) {
      // Invalida cache online para forçar nova verificação
      invalidateOnlineCache();

      const info = getLicenseInfo(getOptions());
      res.json({
        success: true,
        message: result.message,
        license: {
          plan: info.plan,
          product: info.product,
          activatedAt: info.activatedAt,
          expiresAt: info.expiresAt,
        },
      });
      return;
    }

    res.status(400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/license/machine — informações detalhadas da máquina */
router.get('/machine', (_req: Request, res: Response) => {
  try {
    const hwInfo = collectHardwareInfo();
    res.json({
      machineId: hwInfo.machine_id,
      hostname: hwInfo.hostname,
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
        machine_id: hwInfo.machine_id,
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
