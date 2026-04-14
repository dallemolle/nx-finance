# Controle Financeiro Pessoal - NX Finance

Estrutura inicial do projeto desenvolvida com Next.js 15, Prisma e NextAuth.

## 📂 Estrutura de Pastas

```text
nx-finance/
├── prisma/
│   └── schema.prisma      # Definição do banco de dados (PostgreSQL)
├── src/
│   ├── app/
│   │   ├── api/           # Endpoints da API (Auth, Transações)
│   │   ├── auth/          # Login e Verificação 2FA
│   │   ├── dashboard/     # Página principal do Dashboard
│   │   └── layout.tsx     # Layout global
│   ├── components/        # Componentes UI (Shadcn/UI)
│   ├── lib/               # Configurações (Prisma Client, Auth)
│   └── middleware.ts      # Lógica de proteção de rotas e 2FA
├── .env                   # Variáveis de ambiente (DATABASE_URL, SECRET)
├── package.json           # Dependências do projeto
└── tailwind.config.ts     # Configuração do Tailwind CSS
```

## 🚀 Como Executar

Como o ambiente local não possui o Node.js configurado no PATH, siga estes passos em seu terminal local:

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure o Banco de Dados**:
   Crie um arquivo `.env` na raiz com sua URL do PostgreSQL:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/finance_db"
   NEXTAUTH_SECRET="seu-segredo-aqui"
   ```

3. **Gere o Prisma Client**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Inicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

## ✨ Funcionalidades Implementadas (Estrutura)

- [x] **Schema Prisma**: Tabelas para Usuário, Transações, Categorias, Métodos de Pagamento e Metas.
- [x] **Middleware 2FA**: Lógica de redirecionamento para verificação de segundo fator.
- [x] **Dashboard Premium**: Interface com Recharts, cards de resumo e sistema de metas.
- [x] **Relacionamentos**: Transações vinculadas a Categorias e Métodos de Pagamento.


nota leandro para subir o projeto:
docker-compose up --build -d

docker-compose exec app npx prisma@6 db push

npx prisma generate
npx prisma db push
npm run dev
