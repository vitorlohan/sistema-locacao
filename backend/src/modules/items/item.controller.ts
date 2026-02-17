import { Request, Response } from 'express';
import { itemService } from './item.service';

export class ItemController {
  create(req: Request, res: Response): void {
    const item = itemService.create(req.body);
    res.status(201).json(item);
  }

  findAll(req: Request, res: Response): void {
    const filters = {
      category: req.query.category as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };
    const items = itemService.findAll(filters);
    res.json(items);
  }

  findById(req: Request, res: Response): void {
    const item = itemService.findById(Number(req.params.id));
    res.json(item);
  }

  update(req: Request, res: Response): void {
    const item = itemService.update(Number(req.params.id), req.body);
    res.json(item);
  }

  delete(req: Request, res: Response): void {
    itemService.delete(Number(req.params.id));
    res.status(204).send();
  }

  getCategories(_req: Request, res: Response): void {
    const categories = itemService.getCategories();
    res.json(categories);
  }

  getPricing(req: Request, res: Response): void {
    const pricing = itemService.findPricingByItem(Number(req.params.id));
    res.json(pricing);
  }

  savePricing(req: Request, res: Response): void {
    const pricing = itemService.savePricing(Number(req.params.id), req.body.tiers || []);
    res.json(pricing);
  }
}

export const itemController = new ItemController();
