import { getDatabase } from '../../database';
import bcrypt from 'bcrypt';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: string;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  active?: boolean;
}

interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export class UserService {
  async create(input: CreateUserInput): Promise<UserResponse> {
    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
    if (existing) {
      throw new ConflictError('Email já está em uso');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const result = db
      .prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(input.name, input.email, hashedPassword, input.role || 'operator');

    return this.findById(result.lastInsertRowid as number);
  }

  findAll(): UserResponse[] {
    const db = getDatabase();
    return db
      .prepare('SELECT id, name, email, role, active, created_at, updated_at FROM users ORDER BY name')
      .all() as UserResponse[];
  }

  findById(id: number): UserResponse {
    const db = getDatabase();
    const user = db
      .prepare('SELECT id, name, email, role, active, created_at, updated_at FROM users WHERE id = ?')
      .get(id) as UserResponse | undefined;

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    return user;
  }

  async update(id: number, input: UpdateUserInput): Promise<UserResponse> {
    const db = getDatabase();
    this.findById(id); // verify exists

    if (input.email) {
      const existing = db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(input.email, id);
      if (existing) {
        throw new ConflictError('Email já está em uso');
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.email !== undefined) {
      fields.push('email = ?');
      values.push(input.email);
    }
    if (input.password !== undefined) {
      fields.push('password = ?');
      values.push(await bcrypt.hash(input.password, 10));
    }
    if (input.role !== undefined) {
      fields.push('role = ?');
      values.push(input.role);
    }
    if (input.active !== undefined) {
      fields.push('active = ?');
      values.push(input.active ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: number): void {
    const db = getDatabase();
    this.findById(id);
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);
  }
}

export const userService = new UserService();
