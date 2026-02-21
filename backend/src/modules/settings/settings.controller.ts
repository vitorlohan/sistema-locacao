import { Request, Response } from 'express';
import { settingsService } from './settings.service';

export class SettingsController {
  getAll(req: Request, res: Response): void {
    const prefix = req.query.prefix as string | undefined;
    const settings = prefix ? settingsService.getByPrefix(prefix) : settingsService.getAll();
    res.json(settings);
  }

  get(req: Request, res: Response): void {
    const key = req.params.key as string;
    const value = settingsService.get(key);
    res.json({ key, value });
  }

  set(req: Request, res: Response): void {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ message: 'key e value são obrigatórios' });
      return;
    }
    settingsService.set(key, String(value));
    res.json({ key, value: String(value) });
  }

  setMany(req: Request, res: Response): void {
    const entries = req.body;
    if (!entries || typeof entries !== 'object') {
      res.status(400).json({ message: 'Body deve ser um objeto {key: value}' });
      return;
    }
    settingsService.setMany(entries);
    res.json({ message: 'Configurações salvas', count: Object.keys(entries).length });
  }
}

export const settingsController = new SettingsController();
