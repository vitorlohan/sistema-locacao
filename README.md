# Sistema de Locação

Sistema desktop completo para gerenciamento de locação de itens, desenvolvido com **Electron**, **React** e **Node.js**.

Empacotado como instalador `.exe` para Windows — o usuário final não precisa instalar nenhuma dependência.

---

## Tecnologias

| Camada | Stack |
|---|---|
| **Desktop** | Electron 33 (Chromium + Node.js) |
| **Frontend** | React 18, TypeScript, Vite 5 |
| **Backend** | Express 5, TypeScript, Node.js |
| **Banco de Dados** | SQLite (better-sqlite3) — local, sem servidor |
| **Autenticação** | JWT com refresh token + controle de sessões |
| **Licenciamento** | Validação online via [central-licencas](https://github.com/seu-usuario/central-licencas) + vinculação por hardware |

---

## Funcionalidades

- **Clientes** — Cadastro completo com CPF/CNPJ, telefone, endereço
- **Itens** — Catálogo de itens para locação com preços flexíveis por duração
- **Locações** — Controle de aluguéis ativos, devoluções, multas por atraso
- **Pagamentos** — Registro de pagamentos com múltiplos métodos (dinheiro, PIX, cartão)
- **Caixa** — Abertura/fechamento de caixa com controle de entradas e saídas
- **Relatórios** — Relatórios financeiros com exportação em PDF
- **Backup** — Backup automático e manual do banco de dados (compactado .gz)
- **Usuários** — Sistema de permissões por papel (admin/operador) + permissões individuais
- **Segurança** — Rate limiting, sanitização XSS, auditoria de ações, logs de login
- **Licença** — Ativação por chave vinculada ao hardware da máquina

---

## Estrutura do Projeto

```
sistema-locacao/
├── electron/           # Processo principal do Electron
│   ├── main.js         # Lifecycle da app desktop
│   └── icon.ico        # Ícone do aplicativo
├── backend/            # API REST (Express + SQLite)
│   ├── src/
│   │   ├── server.ts           # Entry point
│   │   ├── config/             # Configurações centralizadas
│   │   ├── database/           # Conexão, migrações, seed
│   │   ├── middlewares/        # Auth, rate limit, sanitização, validação
│   │   ├── modules/            # Módulos da aplicação
│   │   │   ├── auth/           # Login, logout, refresh token
│   │   │   ├── users/          # CRUD de usuários
│   │   │   ├── clients/        # CRUD de clientes
│   │   │   ├── items/          # CRUD de itens + pricing
│   │   │   ├── rentals/        # Locações
│   │   │   ├── payments/       # Pagamentos
│   │   │   ├── cashier/        # Caixa financeiro
│   │   │   ├── reports/        # Relatórios + PDF
│   │   │   ├── backup/         # Backup/restore do banco
│   │   │   └── license/        # Ativação e validação de licença
│   │   ├── services/           # Audit log, backup, sessões
│   │   └── utils/              # Encryption, errors, permissions, hardware
│   └── public/                 # Frontend compilado (produção)
├── frontend/           # Interface React (Vite)
│   └── src/
│       ├── components/         # Layout, Modal, ConfirmDialog
│       ├── contexts/           # AuthContext (JWT)
│       ├── pages/              # Todas as páginas da aplicação
│       ├── services/           # API client (Axios)
│       ├── types/              # TypeScript interfaces
│       └── utils/              # Helpers e formatadores
└── package.json        # Configuração raiz + Electron Builder
```

---

## Pré-requisitos (Desenvolvimento)

- **Node.js** 20+ (recomendado 22 LTS)
- **Python** 3.10+ (necessário para compilar `better-sqlite3`)
- **Visual Studio Build Tools** (Windows — para node-gyp)

---

## Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/sistema-locacao.git
cd sistema-locacao

# Instalar todas as dependências (raiz + backend + frontend)
npm install
```

---

## Desenvolvimento

### Modo navegador (mais rápido para desenvolver)

```bash
npm run dev
```

Acesse `http://localhost:5173` no navegador. Backend roda na porta 3000 com hot-reload.

### Modo Electron (testar como app desktop)

```bash
# 1. Compilar frontend (necessário uma vez ou após mudanças)
npm run build:frontend

# 2. Rodar com Electron
npm run dev:electron
```

> **Nota:** Em desenvolvimento, a verificação de licença é automaticamente desabilitada.

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Backend + Frontend com hot-reload |
| `npm run dev:electron` | Backend + Electron (app desktop) |
| `npm run dev:backend` | Apenas backend |
| `npm run dev:frontend` | Apenas frontend |
| `npm run build` | Compilar frontend + backend |
| `npm run build:frontend` | Compilar apenas frontend |
| `npm run build:backend` | Compilar apenas backend |

---

## Gerar Instalador (.exe)

Para gerar o executável de distribuição:

```bash
# 1. Compilar frontend e backend
npm run build:frontend
npm run build:backend

# 2. Recompilar better-sqlite3 para o Electron
npx @electron/rebuild -m backend -v 33.2.1 -o better-sqlite3

# 3. Gerar instalador
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win --config
```

O instalador será gerado em `release/Sistema de Locação Setup X.X.X.exe` (~101 MB).

### Por que recompilar o better-sqlite3?

O `better-sqlite3` é um módulo nativo compilado em C++. Em desenvolvimento ele é compilado para o Node.js do sistema, mas para distribuição precisa ser compilado para o Node.js embutido no Electron (versão diferente). Sem isso, o app vai crashar ao tentar abrir o banco de dados.

### Voltar para desenvolvimento após gerar o .exe

```bash
cd backend
npm rebuild better-sqlite3
```

---

## Distribuição

O arquivo `.exe` é auto-suficiente. O usuário final:

1. Recebe o arquivo `Sistema de Locação Setup X.X.X.exe`
2. Executa o instalador (Avançar → pasta → Instalar)
3. Abre pelo atalho na Área de Trabalho
4. Ativa a licença na página `/ativar`
5. Faz login com as credenciais padrão:
   - **Email:** `admin@sistema.local`
   - **Senha:** `admin123`

**Não é necessário instalar** Node.js, Python ou qualquer outra dependência na máquina do usuário.

---

## Licenciamento

O sistema utiliza validação de licença vinculada ao hardware:

- **Ativação:** Chave no formato `XXXX-XXXX-XXXX-XXXX-XXXX`
- **Vinculação:** CPU ID, serial do disco, MAC address, hostname
- **Validação:** Online contra o servidor [central-licencas](https://github.com/seu-usuario/central-licencas)
- **Dados coletados:** Enviados ao painel administrativo para controle de ativações

O servidor de licenças é configurado em `backend/src/config/index.ts` na propriedade `license.serverUrl`.

---

## Configuração

Variáveis de ambiente (opcionais — o sistema funciona com valores padrão):

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `DB_PATH` | `./data/locacao.db` | Caminho do banco SQLite |
| `BACKUP_DIR` | `./backups` | Diretório de backups |
| `JWT_SECRET` | (embutido) | Segredo para tokens JWT |
| `LICENSE_SERVER_URL` | `https://central-licencas.onrender.com` | URL do servidor de licenças |
| `LICENSE_SECRET` | (embutido) | Segredo para validação de licença |
| `SKIP_LICENSE` | - | Definir como `false` para forçar licença em dev |

---

## Banco de Dados

O SQLite é gerenciado automaticamente:

- **Migrações** são aplicadas automaticamente ao iniciar o servidor
- **Seed** cria o usuário admin padrão na primeira execução
- **Backup automático** a cada 4 horas (configurável)
- **WAL mode** ativado para melhor performance de escrita

O banco fica em `backend/data/locacao.db`.

---

## Segurança

- **JWT** com Access Token (30min) + Refresh Token (7 dias)
- **Controle de sessões** com limite por usuário (máx. 5)
- **Rate limiting** global e por endpoint (login: 10 req/15min)
- **Sanitização XSS** em todas as entradas
- **Bloqueio por tentativas** — 5 falhas = bloqueio de 15min
- **Auditoria** — todas as ações são registradas
- **Logs de login** — sucesso e falha com IP/User-Agent

---

## Licença

Projeto privado. Todos os direitos reservados.
