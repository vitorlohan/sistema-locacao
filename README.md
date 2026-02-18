<div align="center">

# 🏗️ Sistema de Locação

**Sistema desktop completo para gerenciamento de locação de itens**

Desenvolvido com Electron · React · Express · SQLite

[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/Licença-Proprietária-red)](#licença)

</div>

---

Aplicação desktop empacotada como instalador `.exe` para Windows. O usuário final não precisa instalar nenhuma dependência — basta executar o instalador e começar a usar.

## Índice

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Desenvolvimento](#desenvolvimento)
- [Build & Distribuição](#build--distribuição)
- [Configuração](#configuração)
- [Banco de Dados](#banco-de-dados)
- [Segurança](#segurança)
- [Licenciamento](#licenciamento)
- [Licença](#licença)

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Clientes** | Cadastro completo com CPF/CNPJ, telefone, endereço e histórico de locações |
| **Itens** | Catálogo com código interno, categorias e precificação flexível por duração (hora, dia, semana, mês) |
| **Locações** | Controle de aluguéis ativos, devoluções, cálculo automático de multa por atraso e depósitos |
| **Pagamentos** | Registro com múltiplos métodos — dinheiro, PIX, cartão de crédito/débito, transferência |
| **Caixa** | Abertura/fechamento de caixa com controle de entradas, saídas, categorias e resumo por método de pagamento |
| **Relatórios** | Dashboard com KPIs, gráficos (Recharts), ranking de itens/clientes e exportação em **PDF** e **CSV** |
| **Backup** | Backup automático (a cada 4h) e manual do banco de dados, com restore e download |
| **Usuários** | Dois papéis (admin/operador) com **30+ permissões granulares** e override individual |
| **Segurança** | Rate limiting, sanitização XSS, auditoria completa de ações, logs de login com IP/User-Agent |
| **Licença** | Ativação por chave vinculada ao hardware da máquina via [central-licencas](https://github.com/vitorlohan/central-licencas) |

---

## Tecnologias

| Camada | Stack |
|---|---|
| **Desktop** | Electron 33 (Chromium + Node.js) |
| **Frontend** | React 18, TypeScript 5, Vite 5, React Router 7, Recharts, Axios |
| **Backend** | Express 5, TypeScript 5, Node.js 22 |
| **Banco de Dados** | SQLite 3 via better-sqlite3 — local, sem servidor externo |
| **Autenticação** | JWT (access + refresh token), bcryptjs, controle de sessões |
| **PDF** | PDFKit para geração de relatórios |
| **Licenciamento** | Validação online + offline com vinculação por hardware |
| **Build** | electron-builder → instalador NSIS (.exe) para Windows x64 |

---

## Arquitetura

```
sistema-locacao/
├── electron/                   # Processo principal do Electron
│   ├── main.js                 # Lifecycle, tray, single-instance lock
│   └── icon.ico                # Ícone do aplicativo
│
├── backend/                    # API REST (Express 5 + SQLite)
│   └── src/
│       ├── server.ts           # Entry point + graceful shutdown
│       ├── config/             # Configurações centralizadas
│       ├── database/           # Conexão, migrações (15 migrations), seed
│       ├── middlewares/        # Auth, rate limit, sanitização, validação
│       ├── modules/
│       │   ├── auth/           # Login, logout, refresh token
│       │   ├── users/          # CRUD + permissões granulares
│       │   ├── clients/        # CRUD + histórico
│       │   ├── items/          # CRUD + pricing por duração
│       │   ├── rentals/        # Locações + multas + devoluções
│       │   ├── payments/       # Pagamentos multimétodo
│       │   ├── cashier/        # Caixa financeiro completo
│       │   ├── reports/        # Relatórios + PDF + CSV
│       │   ├── backup/         # Backup/restore automático
│       │   └── license/        # Ativação e validação de licença
│       ├── services/           # Audit log, backup scheduler, sessões
│       └── utils/              # Encryption, errors, permissions, hardware
│
├── frontend/                   # Interface React (Vite)
│   └── src/
│       ├── components/         # Layout, Modal, ConfirmDialog
│       ├── contexts/           # AuthContext (JWT)
│       ├── pages/              # Dashboard, Clientes, Itens, Locações, etc.
│       ├── services/           # API client (Axios)
│       ├── types/              # TypeScript interfaces
│       └── utils/              # Helpers e formatadores
│
└── package.json                # Monorepo config + Electron Builder
```

---

## Pré-requisitos

> Apenas para desenvolvimento. O usuário final não precisa de nada — só o `.exe`.

- **Node.js** 20+ (recomendado 22 LTS)
- **Python** 3.10+ (necessário para compilar `better-sqlite3` via node-gyp)
- **Visual Studio Build Tools** com workload "Desktop development with C++"

---

## Instalação

```bash
# Clonar repositório
git clone https://github.com/vitorlohan/sistema-locacao.git
cd sistema-locacao

# Instalar todas as dependências (raiz + backend + frontend)
npm install
```

O `postinstall` executa automaticamente `npm install` no backend e frontend.

---

## Desenvolvimento

### Modo navegador (recomendado para dev)

```bash
npm run dev
```

Frontend em `http://localhost:5173` com hot-reload. Backend na porta `3000`.

### Modo Electron (testar como app desktop)

```bash
npm run build:frontend    # compilar frontend (necessário 1x ou após mudanças no front)
npm run dev:electron      # inicia backend + Electron
```

> Em desenvolvimento, a verificação de licença é desabilitada automaticamente.

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Backend + Frontend com hot-reload (navegador) |
| `npm run dev:electron` | Backend + Electron (app desktop) |
| `npm run dev:backend` | Apenas backend com hot-reload |
| `npm run dev:frontend` | Apenas frontend com hot-reload |
| `npm run build` | Compilar frontend + backend para produção |

---

## Build & Distribuição

### Gerar instalador `.exe`

```bash
# 1. Compilar frontend e backend
npm run build

# 2. Recompilar better-sqlite3 para o Electron
npx @electron/rebuild -m backend -v 33.2.1 -o better-sqlite3

# 3. Gerar instalador (sem assinatura de código)
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win --config
```

O instalador será gerado em `release/Sistema de Locação Setup X.X.X.exe` (~101 MB).

<details>
<summary><strong>Por que recompilar o better-sqlite3?</strong></summary>

O `better-sqlite3` é um módulo nativo em C++. Em desenvolvimento ele é compilado para o Node.js do sistema, mas para distribuição precisa ser recompilado para o Node.js embutido no Electron (versão diferente da ABI). Sem isso, o app crasha ao tentar abrir o banco de dados.

Para voltar ao modo desenvolvimento após gerar o `.exe`:

```bash
cd backend && npm rebuild better-sqlite3
```

</details>

### O que o usuário final recebe

1. Arquivo `Sistema de Locação Setup X.X.X.exe` (instalador NSIS)
2. Executa o instalador → escolhe pasta → instalar
3. Abre pelo atalho na Área de Trabalho
4. Ativa a licença na tela `/ativar`
5. Login com credenciais padrão:
   - **Email:** `admin@sistema.local`
   - **Senha:** `admin123`

**Nenhuma dependência externa** precisa ser instalada na máquina do cliente.

---

## Configuração

Variáveis de ambiente (opcionais — o sistema funciona com valores padrão):

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta do servidor backend |
| `DB_PATH` | `./data/locacao.db` | Caminho do banco SQLite |
| `BACKUP_DIR` | `./backups` | Diretório de backups |
| `JWT_SECRET` | (embutido) | Segredo para assinatura de tokens JWT |
| `LICENSE_SERVER_URL` | `https://central-licencas.onrender.com` | URL do servidor de licenças |
| `LICENSE_SECRET` | (embutido) | Segredo compartilhado para validação |
| `SKIP_LICENSE` | `true` (dev) | Definir como `false` para forçar licença em dev |

---

## Banco de Dados

O SQLite é gerenciado automaticamente — sem configuração manual:

| Recurso | Detalhe |
|---|---|
| **Migrações** | 15 migrations aplicadas automaticamente ao iniciar |
| **Seed** | Cria usuário admin padrão na primeira execução |
| **WAL mode** | Ativado para melhor performance de escrita concorrente |
| **Backup automático** | A cada 4 horas (configurável), máximo 10 backups retidos |
| **Localização** | `backend/data/locacao.db` |

### Tabelas principais

`users` · `clients` · `items` · `item_pricing` · `rentals` · `payments` · `cash_registers` · `cash_transactions` · `sessions` · `login_logs` · `audit_logs`

---

## Segurança

| Mecanismo | Implementação |
|---|---|
| **Autenticação** | JWT Access Token (30 min) + Refresh Token (7 dias) |
| **Sessões** | Controle por JTI, máximo 5 sessões simultâneas por usuário |
| **Rate limiting** | Global: 500 req/15 min · Login: 10 req/15 min |
| **Brute force** | Bloqueio automático após 5 tentativas falhas (15 min) |
| **XSS** | Sanitização em todas as entradas |
| **Auditoria** | Todas as ações registradas com usuário, recurso, IP e timestamp |
| **Logs de login** | Sucesso e falha com IP e User-Agent |

---

## Licenciamento

O sistema utiliza validação de licença vinculada ao hardware, gerenciada pelo projeto [central-licencas](https://github.com/vitorlohan/central-licencas):

- **Formato:** `XXXX-XXXX-XXXX-XXXX-XXXX`
- **Vinculação:** CPU ID, serial do disco, MAC address, hostname
- **Validação:** Online na ativação + verificação periódica a cada 5 minutos
- **Offline:** Funciona offline após a primeira ativação (arquivo `.license` local)

---

## Licença

Este é um projeto proprietário. Todos os direitos reservados.
