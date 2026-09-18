# Driver_Pey

Sistema web para gestão de pagamentos a motoristas e controle de entregas (romaneios, CTRCs e uso do aplicativo).

## Stack

- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** React + Vite
- **Autenticação:** JWT (CPF + Matrícula)

## Estrutura

```
Driver_Pey/
├── backend/          # API REST
│   └── src/
│       ├── routes/       # auth, driver, admin, upload
│       ├── services/     # paymentService, xlsxService, driverService
│       ├── db/           # Pool PostgreSQL
│       └── middleware/   # JWT auth
├── frontend/         # SPA React
│   └── src/
│       ├── pages/        # Login, DriverDashboard, AdminPagamentos, AdminUpload
│       ├── components/   # Topbar
│       └── services/     # api.js (axios client)
└── README.md
```

## Requisitos

- Node.js 18+
- PostgreSQL com as tabelas: `relatorioentrega_export`, `lista_entregas`, `matriculos_jad`, `faixas_peso`, `tabela_frete_motorista`

## Configuração

### 1. Banco de Dados

Edite `backend/.env` com as credenciais do PostgreSQL:

```env
PORT=3001
DB_HOST=163.176.242.98
DB_PORT=5432
DB_NAME=driverfds
DB_USER=postgres
DB_PASS=PUhgB0AZWAfhfm9qFe0sDcLzQG09hTGLkSC3eOa66e333b7b
JWT_SECRET=0e560c48d422acdbf0b106df4dc154c5
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

A API inicia em `http://localhost:3001`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend inicia em `http://localhost:5173`.

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login motorista (CPF + Matrícula) |
| GET | `/api/auth/me` | Dados do token |
| GET | `/api/driver/dashboard` | Resumo de produtividade |
| GET | `/api/driver/trips` | Viagens do motorista |
| GET | `/api/driver/me` | Dados do motorista logado |
| POST | `/api/upload` | Upload XLSX |
| POST | `/api/upload/preview` | Preview do XLSX |
| GET | `/api/admin/pagamentos?inicio=&fim=` | Pagamentos por período |
| GET | `/api/admin/resumo?inicio=&fim=` | Resumo consolidado |
| POST | `/api/admin/confirmar-pagamento` | Confirmar pagamento |

## Regra de Cálculo

- **Receita:** Valor da faixa de peso (tabela `faixas_peso`) + R$ 0,80/kg excedente acima de 15kg
- **Custo:** Quantidade de CT-es × valor_frete da `tabela_frete_motorista` por métrica
- **Margem:** Receita — Custo
