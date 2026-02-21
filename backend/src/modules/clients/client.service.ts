import { getDatabase } from '../../database';
import { encrypt, decrypt, NotFoundError, ValidationError } from '../../utils';

interface CreateClientInput {
  name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  observations?: string;
  child_name?: string;
  birth_date?: string;
}

interface UpdateClientInput {
  name?: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  observations?: string;
  active?: boolean;
  child_name?: string;
  birth_date?: string;
}

interface ClientRow {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  observations: string | null;
  child_name: string | null;
  birth_date: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

interface ClientResponse {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  observations: string | null;
  child_name: string | null;
  birth_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function decryptClient(row: ClientRow): ClientResponse {
  return {
    ...row,
    active: !!row.active,
    document: row.document ? decrypt(row.document) : null,
    phone: row.phone ? decrypt(row.phone) : null,
    observations: row.observations ? decrypt(row.observations) : null,
    child_name: row.child_name || null,
    birth_date: row.birth_date || null,
  };
}

export class ClientService {
  create(input: CreateClientInput): ClientResponse {
    const db = getDatabase();

    const result = db
      .prepare(
        `INSERT INTO clients (name, document, phone, email, address, observations, child_name, birth_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.name,
        input.document ? encrypt(input.document) : null,
        input.phone ? encrypt(input.phone) : null,
        input.email || null,
        input.address || null,
        input.observations ? encrypt(input.observations) : null,
        input.child_name || null,
        input.birth_date || null
      );

    return this.findById(result.lastInsertRowid as number);
  }

  findAll(search?: string): ClientResponse[] {
    const db = getDatabase();
    let rows: ClientRow[];

    if (search) {
      rows = db
        .prepare(
          'SELECT * FROM clients WHERE active = 1 AND name LIKE ? ORDER BY name'
        )
        .all(`%${search}%`) as ClientRow[];
    } else {
      rows = db
        .prepare('SELECT * FROM clients WHERE active = 1 ORDER BY name')
        .all() as ClientRow[];
    }

    return rows.map(decryptClient);
  }

  findById(id: number): ClientResponse {
    const db = getDatabase();
    const row = db
      .prepare('SELECT * FROM clients WHERE id = ?')
      .get(id) as ClientRow | undefined;

    if (!row) {
      throw new NotFoundError('Cliente');
    }

    return decryptClient(row);
  }

  update(id: number, input: UpdateClientInput): ClientResponse {
    const db = getDatabase();
    this.findById(id);

    const fields: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.document !== undefined) {
      fields.push('document = ?');
      values.push(input.document ? encrypt(input.document) : null);
    }
    if (input.phone !== undefined) {
      fields.push('phone = ?');
      values.push(input.phone ? encrypt(input.phone) : null);
    }
    if (input.email !== undefined) {
      fields.push('email = ?');
      values.push(input.email);
    }
    if (input.address !== undefined) {
      fields.push('address = ?');
      values.push(input.address);
    }
    if (input.observations !== undefined) {
      fields.push('observations = ?');
      values.push(input.observations ? encrypt(input.observations) : null);
    }
    if (input.active !== undefined) {
      fields.push('active = ?');
      values.push(input.active ? 1 : 0);
    }
    if (input.child_name !== undefined) {
      fields.push('child_name = ?');
      values.push(input.child_name || null);
    }
    if (input.birth_date !== undefined) {
      fields.push('birth_date = ?');
      values.push(input.birth_date || null);
    }

    if (fields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    this.findById(id);
    db.prepare('UPDATE clients SET active = 0 WHERE id = ?').run(id);
  }

  getRentalHistory(clientId: number): any[] {
    const db = getDatabase();
    this.findById(clientId);

    return db
      .prepare(
        `SELECT r.*, i.name as item_name, i.internal_code 
         FROM rentals r 
         JOIN items i ON r.item_id = i.id 
         WHERE r.client_id = ? 
         ORDER BY r.created_at DESC`
      )
      .all(clientId);
  }
}

export const clientService = new ClientService();
