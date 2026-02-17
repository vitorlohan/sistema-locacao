import { Router, Request, Response } from 'express';
import { backupService } from '../../services';
import { authMiddleware, requirePermission } from '../../middlewares';
import { AuthRequest } from '../../middlewares';
import { auditLogService } from '../../services/auditLog.service';
import { PERMISSIONS } from '../../utils/permissions';

const router = Router();

router.use(authMiddleware);

// POST /create — Create manual backup
router.post('/create', requirePermission(PERMISSIONS.BACKUP_CREATE), (req: AuthRequest, res: Response) => {
  try {
    const backup = backupService.createBackup(false);

    auditLogService.log({
      userId: req.userId,
      action: 'BACKUP_CREATE',
      resource: 'backup',
      details: `Backup manual criado: ${backup.name}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Backup criado com sucesso', backup });
  } catch (error: any) {
    res.status(500).json({ error: true, message: error.message });
  }
});

// GET /list — List all backups
router.get('/list', requirePermission(PERMISSIONS.BACKUP_LIST), (_req: Request, res: Response) => {
  const backups = backupService.listBackups();
  res.json(backups);
});

// GET /stats — Get backup statistics
router.get('/stats', requirePermission(PERMISSIONS.BACKUP_LIST), (_req: Request, res: Response) => {
  const stats = backupService.getStats();
  res.json(stats);
});

// GET /settings — Get backup settings
router.get('/settings', requirePermission(PERMISSIONS.BACKUP_LIST), (_req: Request, res: Response) => {
  const settings = backupService.getSettings();
  res.json(settings);
});

// PUT /settings — Update backup settings
router.put('/settings', requirePermission(PERMISSIONS.BACKUP_CREATE), (req: AuthRequest, res: Response) => {
  try {
    const settings = backupService.updateSettings(req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'BACKUP_SETTINGS',
      resource: 'backup',
      details: `Configurações de backup atualizadas`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Configurações atualizadas', settings });
  } catch (error: any) {
    res.status(400).json({ error: true, message: error.message });
  }
});

// GET /download/:filename — Download a backup file
router.get('/download/:filename', requirePermission(PERMISSIONS.BACKUP_LIST), (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;
    const filePath = backupService.getBackupPath(filename);
    res.download(filePath, filename);
  } catch (error: any) {
    res.status(404).json({ error: true, message: error.message });
  }
});

// DELETE /delete/:filename — Delete a backup
router.delete('/delete/:filename', requirePermission(PERMISSIONS.BACKUP_CREATE), (req: AuthRequest, res: Response) => {
  try {
    const filename = req.params.filename as string;
    backupService.deleteBackup(filename);

    auditLogService.log({
      userId: req.userId,
      action: 'BACKUP_DELETE',
      resource: 'backup',
      details: `Backup excluído: ${filename}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Backup excluído com sucesso' });
  } catch (error: any) {
    res.status(404).json({ error: true, message: error.message });
  }
});

// POST /restore — Restore a backup
router.post('/restore', requirePermission(PERMISSIONS.BACKUP_RESTORE), (req: AuthRequest, res: Response) => {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).json({ error: true, message: 'Informe o nome do arquivo de backup' });
    return;
  }
  try {
    backupService.restoreBackup(filename);

    auditLogService.log({
      userId: req.userId,
      action: 'BACKUP_RESTORE',
      resource: 'backup',
      details: `Backup restaurado: ${filename}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Backup restaurado com sucesso. Reinicie o servidor para aplicar.' });
  } catch (error: any) {
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;
