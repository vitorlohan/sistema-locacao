import { getDatabase } from '../../database';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';

interface CreateItemInput {
  name: string;
  internal_code: string;
  category: string;
  rental_value?: number;
  rental_period?: string;
  status?: string;
  observations?: string;
  pricing_tiers?: { duration_minutes: number; label: string; price: number; tolerance_minutes?: number }[];
}

interface UpdateItemInput {
  name?: string;
  internal_code?: string;
  category?: string;
  rental_value?: number;
  rental_period?: string;
  status?: string;
  observations?: string;
  active?: boolean;
}

interface ItemResponse {
  id: number;
  name: string;
  internal_code: string;
  category: string;
  rental_value: number;
  rental_period: string;
  status: string;
  observations: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export class ItemService {
  create(input: CreateItemInput): ItemResponse {
    const db = getDatabase();

    const existing = db
      .prepare('SELECT id FROM items WHERE internal_code = ?')
      .get(input.internal_code);
    if (existing) {
      throw new ConflictError('Código interno já está em uso');
    }

    // If pricing tiers provided, use first tier's price as rental_value
    const tiers = input.pricing_tiers || [];
    const rentalValue = tiers.length > 0 ? tiers[0].price : (input.rental_value || 0);

    const result = db
      .prepare(
        `INSERT INTO items (name, internal_code, category, rental_value, rental_period, status, observations) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.internal_code,
        input.category,
        rentalValue,
        input.rental_period || 'hour',
        input.status || 'available',
        input.observations || null
      );

    const itemId = result.lastInsertRowid as number;

    // Save pricing tiers if provided
    if (tiers.length > 0) {
      const insertTier = db.prepare(
        'INSERT INTO item_pricing (item_id, duration_minutes, label, price, tolerance_minutes, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      );
      tiers.forEach((tier, idx) => {
        insertTier.run(itemId, tier.duration_minutes, tier.label, tier.price, tier.tolerance_minutes || 0, idx);
      });
    }

    return this.findById(itemId);
  }

  findAll(filters?: { category?: string; status?: string; search?: string }): ItemResponse[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM items WHERE active = 1';
    const params: any[] = [];

    if (filters?.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.search) {
      sql += ' AND (name LIKE ? OR internal_code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY name';

    return db.prepare(sql).all(...params) as ItemResponse[];
  }

  findById(id: number): ItemResponse {
    const db = getDatabase();
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemResponse | undefined;

    if (!item) {
      throw new NotFoundError('Item');
    }

    return item;
  }

  update(id: number, input: UpdateItemInput): ItemResponse {
    const db = getDatabase();
    this.findById(id);

    if (input.internal_code) {
      const existing = db
        .prepare('SELECT id FROM items WHERE internal_code = ? AND id != ?')
        .get(input.internal_code, id);
      if (existing) {
        throw new ConflictError('Código interno já está em uso');
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.internal_code !== undefined) { fields.push('internal_code = ?'); values.push(input.internal_code); }
    if (input.category !== undefined) { fields.push('category = ?'); values.push(input.category); }
    if (input.rental_value !== undefined) { fields.push('rental_value = ?'); values.push(input.rental_value); }
    if (input.rental_period !== undefined) { fields.push('rental_period = ?'); values.push(input.rental_period); }
    if (input.status !== undefined) { fields.push('status = ?'); values.push(input.status); }
    if (input.observations !== undefined) { fields.push('observations = ?'); values.push(input.observations); }
    if (input.active !== undefined) { fields.push('active = ?'); values.push(input.active ? 1 : 0); }

    if (fields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  updateStatus(id: number, status: string): ItemResponse {
    const db = getDatabase();
    this.findById(id);
    db.prepare("UPDATE items SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(status, id);
    return this.findById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    this.findById(id);
    db.prepare("UPDATE items SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?").run(id);
  }

  getCategories(): string[] {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT DISTINCT category FROM items WHERE active = 1 ORDER BY category')
      .all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  /* ─── Pricing tiers ─── */

  findPricingByItem(itemId: number): any[] {
    const db = getDatabase();
    return db
      .prepare('SELECT * FROM item_pricing WHERE item_id = ? AND active = 1 ORDER BY sort_order, duration_minutes')
      .all(itemId) as any[];
  }

  savePricing(itemId: number, tiers: { duration_minutes: number; label: string; price: number; tolerance_minutes?: number }[]): any[] {
    const db = getDatabase();
    this.findById(itemId);

    const transaction = db.transaction(() => {
      // Remove all current pricing for this item
      db.prepare('DELETE FROM item_pricing WHERE item_id = ?').run(itemId);

      // Insert all tiers
      const insert = db.prepare(
        'INSERT INTO item_pricing (item_id, duration_minutes, label, price, tolerance_minutes, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
      );
      tiers.forEach((tier, idx) => {
        insert.run(itemId, tier.duration_minutes, tier.label, tier.price, tier.tolerance_minutes || 0, idx);
      });
    });

    transaction();
    return this.findPricingByItem(itemId);
  }
}

export const itemService = new ItemService();
