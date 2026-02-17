import { Request, Response } from 'express';
import { clientService } from './client.service';

export class ClientController {
  create(req: Request, res: Response): void {
    const client = clientService.create(req.body);
    res.status(201).json(client);
  }

  findAll(req: Request, res: Response): void {
    const search = req.query.search as string | undefined;
    const clients = clientService.findAll(search);
    res.json(clients);
  }

  findById(req: Request, res: Response): void {
    const client = clientService.findById(Number(req.params.id));
    res.json(client);
  }

  update(req: Request, res: Response): void {
    const client = clientService.update(Number(req.params.id), req.body);
    res.json(client);
  }

  delete(req: Request, res: Response): void {
    clientService.delete(Number(req.params.id));
    res.status(204).send();
  }

  getRentalHistory(req: Request, res: Response): void {
    const history = clientService.getRentalHistory(Number(req.params.id));
    res.json(history);
  }
}

export const clientController = new ClientController();
