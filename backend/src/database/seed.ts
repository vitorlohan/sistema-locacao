import { getDatabase } from './connection';
import bcrypt from 'bcryptjs';

export async function seedDefaultUser(): Promise<void> {
  const db = getDatabase();

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@sistema.local');

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run('Administrador', 'admin@sistema.local', hashedPassword, 'admin');

    console.log('✓ Usuário padrão criado: admin@sistema.local / admin123');
  }
}
