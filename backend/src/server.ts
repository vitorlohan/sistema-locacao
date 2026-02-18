import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import config from './config';
import { runMigrations, seedDefaultUser } from './database';
import { backupService, sessionService } from './services';
import { errorHandler, rateLimit, sanitizeInput } from './middlewares';

// License
import { licenseGuard, licenseRoutes } from './modules/license';

// Routes
import { authRoutes } from './modules/auth';
import { userRoutes } from './modules/users';
import { clientRoutes } from './modules/clients';
import { itemRoutes } from './modules/items';
import { rentalRoutes } from './modules/rentals';
import { paymentRoutes } from './modules/payments';
import { reportRoutes } from './modules/reports';
import { backupRoutes } from './modules/backup';
import { cashierRoutes } from './modules/cashier';

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Sanitização global de entrada (proteção XSS)
app.use(sanitizeInput);

// Rate limit global
app.use(
  rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMax,
    keyPrefix: 'global',
    message: 'Muitas requisições.',
  })
);

// License routes (antes do guard para permitir ativação)
app.use('/api/license', licenseRoutes);

// Health check (antes do guard — sempre acessível)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve frontend estático ANTES do guard (produção)
// Assim a página de ativação de licença fica sempre acessível
const publicDir = path.resolve(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// License guard — bloqueia sistema (API) se não licenciado
app.use(licenseGuard);

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/cashier', cashierRoutes);

// SPA fallback: rotas que não são /api retornam index.html
if (fs.existsSync(publicDir)) {
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 404 (apenas para rotas /api não encontradas)
app.use((_req, res) => {
  res.status(404).json({ error: true, message: 'Rota não encontrada' });
});

// Error handler
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      console.log('===========================================');
      console.log('  SISTEMA DE LOCAÇÃO - Iniciando...');
      console.log('===========================================\n');
    }

    // License check
    if (!isProduction) console.log('🔑 Verificando licença...');
    const { validateLicense: checkLicense } = await import('key-license-manager');
    const licResult = checkLicense({
      secret: config.license.secret,
      storagePath: config.license.storagePath,
    });
    if (!isProduction) {
      if (licResult.valid) {
        console.log('  ✅ Licença válida!');
      } else {
        console.log('  ⚠️  Sistema NÃO licenciado — ative em /ativar');
      }
    }

    // Database
    if (!isProduction) console.log('📦 Configurando banco de dados...');
    runMigrations();

    // Seed
    if (!isProduction) console.log('👤 Verificando usuário padrão...');
    await seedDefaultUser();

    // Cleanup expired sessions
    if (!isProduction) console.log('🔒 Limpando sessões expiradas...');
    const cleaned = sessionService.cleanExpiredSessions();
    if (!isProduction && cleaned > 0) console.log(`  ${cleaned} sessão(ões) expirada(s) removida(s)`);

    // Backup
    if (!isProduction) console.log('💾 Configurando backup automático...');
    backupService.start();

    // Server
    const server = app.listen(config.server.port, config.server.host, () => {
      if (isProduction) {
        // Produção: output mínimo para o usuário
        console.log('');
        console.log('  ✅ Sistema iniciado com sucesso!');
        console.log('');
        console.log(`  Acesse: http://localhost:${config.server.port}`);
        if (!licResult.valid) {
          console.log('');
          console.log('  ⚠️  Sistema nao licenciado — ative em /ativar');
        }
        console.log('');
        console.log('  Nao feche esta janela enquanto estiver usando o sistema.');
        console.log('');
      } else {
        // Desenvolvimento: output completo
        console.log('\n===========================================');
        console.log('  ✅ Servidor iniciado com sucesso!');
        console.log('===========================================');
        console.log(`  Local:    http://localhost:${config.server.port}`);
        console.log(`  Rede:     http://${config.server.localIP}:${config.server.port}`);
        console.log(`  API Base: /api`);
        console.log('===========================================\n');
      }
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\n🛑 Encerrando servidor...');
      backupService.stop();
      server.close(() => {
        try {
          const { closeDatabase } = require('./database');
          closeDatabase();
        } catch { /* */ }
        console.log('✅ Servidor encerrado.');
        process.exit(0);
      });
      // Force after 5s
      setTimeout(() => process.exit(1), 5000);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
}

bootstrap();
