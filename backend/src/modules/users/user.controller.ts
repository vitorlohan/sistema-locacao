import { Request, Response } from 'express';
import { userService } from './user.service';
import { AuthRequest } from '../../middlewares';
import { auditLogService } from '../../services/auditLog.service';
import { getDatabase } from '../../database';

export class UserController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    const user = await userService.create(req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'CREATE',
      resource: 'user',
      resourceId: user.id,
      details: `Usuário criado: ${user.email}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(201).json(user);
  }

  findAll(_req: Request, res: Response): void {
    const users = userService.findAll();
    res.json(users);
  }

  findById(req: Request, res: Response): void {
    const user = userService.findById(Number(req.params.id));
    res.json(user);
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const user = await userService.update(Number(req.params.id), req.body);

    auditLogService.log({
      userId: req.userId,
      action: 'UPDATE',
      resource: 'user',
      resourceId: user.id,
      details: `Usuário atualizado: ${user.email}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json(user);
  }

  updatePermissions(req: AuthRequest, res: Response): void {
    const id = Number(req.params.id);
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: true, message: 'permissions deve ser um array de strings' });
      return;
    }

    const db = getDatabase();
    userService.findById(id); // verify exists

    db.prepare("UPDATE users SET permissions = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(JSON.stringify(permissions), id);

    auditLogService.log({
      userId: req.userId,
      action: 'PERMISSION_CHANGE',
      resource: 'user',
      resourceId: id,
      details: `Permissões atualizadas: ${permissions.join(', ')}`,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    const user = userService.findById(id);
    res.json(user);
  }

  unlockAccount(req: AuthRequest, res: Response): void {
    const id = Number(req.params.id);
    const db = getDatabase();

    userService.findById(id); // verify exists

    db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(id);

    auditLogService.log({
      userId: req.userId,
      action: 'USER_UNLOCK',
      resource: 'user',
      resourceId: id,
      details: 'Conta desbloqueada manualmente',
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.json({ message: 'Conta desbloqueada com sucesso' });
  }

  delete(req: AuthRequest, res: Response): void {
    const id = Number(req.params.id);

    userService.delete(id);

    auditLogService.log({
      userId: req.userId,
      action: 'DELETE',
      resource: 'user',
      resourceId: id,
      details: 'Usuário desativado',
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(204).send();
  }
}

export const userController = new UserController();
