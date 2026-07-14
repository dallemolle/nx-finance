# Contexto do Projeto: NxFinance

## 1. Stack Tecnológica Principal

| Camada | Tecnologia | Versão | Observação |
|--------|-----------|--------|------------|
| Framework | Next.js (App Router) | ^16.2.2 | `src/app/` com Server Components por padrão |
| Linguagem | TypeScript | ^5.6.3 | Strict mode, path alias `@/` → `src/` |
| ORM | Prisma | ^6.0.1 | PostgreSQL via `DATABASE_URL`, engine classic |
| Banco | PostgreSQL | — | Provider configurado no `schema.prisma` |
| UI Primitives | shadcn/ui | New York | Componentes via `@/components/ui/`, estilo `new-york` |
| Estilização | Tailwind CSS | ^3.4.15 | Config com `tailwindcss-animate`, CSS variables via `globals.css` |
| Autenticação | NextAuth | ^4.24.13 | Credentials Provider, JWT session strategy |
| Formulários | react-hook-form | ^7.71.2 | Integrado com `@hookform/resolvers` + Zod |
| Validação | Zod | ^4.3.6 | Schemas em `src/lib/validations.ts` |
| Gráficos | Recharts | ^2.13.3 | Pie/Donut charts no dashboard |
| Datas | date-fns | ^4.1.0 | Locale `ptBR` para formatação em português |
| Cálculos | decimal.js | ^10.6.0 | Precisão financeira em parcelamentos |
| Ícones | Lucide React | ^0.460.0 | Ícones nos componentes de UI |
| Tabelas | @tanstack/react-table | ^8.21.3 | Tabela de relatórios |
| Tema | next-themes | ^0.4.3 | dark/light/system via classe `.dark` |
| Notificações | Sonner | ^2.0.7 | Toasts rich colors, posição top-right |
| CSV | PapaParse | ^5.5.3 | Importação em lote |
| Email | Nodemailer | ^8.0.1 | Envio de tokens 2FA |
| Senhas | bcryptjs | ^3.0.3 | Hash de senhas (salt rounds = 10) |
| Outros | dompurify, cmdk, class-variance-authority, clsx, tailwind-merge | — | Sanitização, command palette, variants CSS |

**Scripts de build:**
```
dev        → next dev
build      → prisma generate && next build
start      → next start
lint       → next lint
postinstall → prisma generate
```

**Configurações notáveis:**
- `tsconfig.json`: strict mode, path alias `@/` → `src/`, target ES2017, moduleResolution bundler
- `next.config.ts`: output `standalone`
- `components.json`: shadcn/ui style `new-york`, baseColor `neutral`, CSS variables habilitadas

---

## 2. Arquitetura e Mapeamento de Arquivos

### `src/app/` — Rotas e Layouts (App Router)

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `layout.tsx` | Server Component | RootLayout: `<html lang="pt-BR">`, Providers, EnvironmentBanner, Toaster Sonner |
| `providers.tsx` | Client Component | Wrapper: SessionProvider + ThemeProvider (attribute="class", defaultTheme="system") |
| `page.tsx` | Server Component | Dashboard principal: sessão → busca dados → renderiza cards, gráficos, transações |
| `globals.css` | Estilos | Definição de CSS variables para `:root` (light) e `.dark`; `@tailwind base/components/utilities` |
| `auth/login/page.tsx` | Client Component | Formulário de login com suporte a 2FA (campo `code` aparece condicionalmente) |
| `auth/register/page.tsx` | Client Component | Formulário de registro → chama `registerUser()` Server Action |
| `reports/page.tsx` | Server Component | Página de relatórios: busca dados + renderiza `ReportContent` + `MonthPicker` |
| `reports/report-content.tsx` | Client Component | Tabela com filtragem por status/categoria/instituição/meio de pagamento |
| `reports/report-filters.tsx` | Client Component | Filtros combinados com Selects |
| `dashboard/settings/page.tsx` | Server Component | Tabs de configuração: Instituições, Categorias, Meios de Pagamento |

### `src/components/dashboard/` — Componentes de Negócio

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `summary-cards.tsx` | Server Component | 3 cards: Saldo (estilo escuro destaque), Entradas, Saídas com delta vs mês anterior |
| `category-chart.tsx` | Client Component | Gráfico donut Recharts com legenda interativa, diálogo de detalhes por categoria |
| `recent-transactions.tsx` | Server Component | Lista de transações do mês separada por Entradas/Saídas |
| `month-picker.tsx` | Client Component | Navegador de mês/ano via URL Search Params (`?month=&year=`) |
| `transaction-form.tsx` | Client Component | Formulário completo com suporte a parcelamento (`decimal.js`), Combobox com criação inline |
| `new-transaction-dialog.tsx` | Client Component | Diálogo para nova transação, carrega dados ao abrir |
| `edit-transaction-dialog.tsx` | Client Component | Diálogo de edição com `initialData` |
| `quick-pay-button.tsx` | Client Component | Botão de pagamento rápido (altera status para PAGO) |
| `csv-import-dialog.tsx` | Client Component | Importação CSV em 2 passos: upload + mapeamento de categorias |
| `credit-card-invoice-dialog.tsx` | Client Component | Importação de fatura de cartão de crédito via CSV: cria cabeçalho is_invoice_header + itens detalhados com categoria |
| `institution-combobox.tsx` | Client Component | Combobox especializado com criação de instituição via diálogo |
| `export-buttons.tsx` | Client Component | Dropdown de exportação (CSV/PDF) — funcionalidade mock |
| `financial-health.tsx` | Client Component | Indicador visual de saúde financeira com Progress |
| `forecast.tsx` | Client Component | Projeção mensal baseada em média diária |
| `settings-forms.tsx` | Client Component | Linhas editáveis para renomear/excluir registros auxiliares |

### `src/components/ui/` — Primitivas shadcn/ui (20 componentes)

`alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `combobox`, `command`, `date-picker`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `select`, `skeleton`, `switch`, `table`, `tabs`

### `src/lib/` — Lógica Compartilhada

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `utils.ts` | Utilitário | `cn()` — merge de classes Tailwind (clsx + tailwind-merge) |
| `validations.ts` | Schema | Schemas Zod: `transactionSchema`, `categorySchema`, `paymentMethodSchema`, `financialInstitutionSchema`, `loginSchema`, `registerSchema` |
| `actions.ts` | Server Actions | CRUD de transações, categorias, métodos de pagamento, instituições financeiras |
| `auth-actions.ts` | Server Action | `registerUser()` — registro + seed de categorias padrão |
| `auth.ts` | Config | `authOptions` — NextAuth config com Credentials Provider + callbacks JWT/Session |
| `dashboard.ts` | Server Action | `getDashboardData()` — agrega totais, deltas, health score, forecast, smart category grouping |
| `dashboard-utils.ts` | Utilitário | `getCategoryGroupName()` — agrupamento inteligente de categorias |
| `reports.ts` | Server Actions | `getReportData()` + `getCategories/PaymentMethods/Institutions()` |
| `credit-card-actions.ts` | Server Actions | `importCreditCardInvoice()` — importa fatura CSV + `getInvoiceItems()` + `getInvoiceHeaders()` |
| `csv-actions.ts` | Server Actions | `processBatchTransactions()`, `getMappingSuggestions()`, `saveMappingSuggestion()` |
| `db.ts` | Singleton | Instância singleton do PrismaClient (cache em `globalThis`) |
| `prisma.ts` | Singleton | Alternativa com log de queries habilitado |
| `mail.ts` / `mail.js` | Serviço | Envio de email 2FA (console.log + Nodemailer) |
| `proxy.ts` | Middleware | `withAuth` — proteção de rotas, lógica 2FA, redirects |

### `src/types/` — Extensões de Tipo

| Arquivo | Propósito |
|---------|-----------|
| `next-auth.d.ts` | Estende `Session.user.id`, `User.id`, `JWT.id` |

---

## 3. Regras de Negócio Implementadas

### 3.1 Validação e Transformação de Dados (Zod)

Todos os schemas em `src/lib/validations.ts` aplicam transformações **antes** de persistir:

- **Capitalização automática**: campos `nome` e `descricao` sofrem `.transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase())` — isso garante que "ALUGUEL" → "Aluguel", "mercado" → "Mercado".
- **Valor monetário**: `z.coerce.number().positive("Valor deve ser positivo")` — rejeita zero e negativos.
- **Datas**: `z.coerce.date()` — aceita strings ISO e converte.
- **Cores**: `z.string().regex(/^#[0-9A-F]{6}$/i)` — valida formato hexadecimal (ex: `#10b981`).
- **Unique constraints**: `@@unique([nome, userId, tipo])` no Prisma para categorias; `@@unique([nome, userId])` para métodos de pagamento e instituições.

### 3.2 Comportamento Específico por Entidade

**Transaction:**
- `data_lancamento` tem `@default(now())` — sempre registra a data de criação automaticamente.
- `data_pagamento` é opcional (`DateTime?`) — só preenchida ao liquidar.
- Status padrão é `PENDENTE`.
- Ao criar uma transação parcelada (`isInstallment === true`):
  - O valor total é dividido usando `decimal.js` com `ROUND_DOWN` e precisão de 2 casas decimais.
  - A última parcela absorve o centavo residual: `lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1))`.
  - Cada parcela recebe data de vencimento incremental: `addMonths(dataVencimento, index)`.
  - Nomes das parcelas seguem o padrão `"Descrição (01/12)"` editável pelo usuário.
  - **O parcelamento só está disponível para `tipo === "SAIDA"`** e apenas na criação (não edição).
- Status `ATRASADO` é **calculado dinamicamente** no servidor: se `status !== "PAGO" && dataVencimento < now()`, o status exibido é "ATRASADO" (não é persistido, apenas calculado na query).

**CreditCardInvoiceItem (modelo auxiliar de fatura de cartão):**
- Relacionamento 1:N com Transaction via `transactionId` — uma transação `is_invoice_header` pode conter N itens.
- `data_vencimento_original` (opcional) armazena a data de vencimento individual do item (se diferente da fatura).
- `categoria_id` vincula cada item a uma Category, permitindo agregação no gráfico de categorias.
- **Liquidação unificada**: apenas a transação principal (is_invoice_header) é liquidada (status → PAGO). Os itens não possuem status próprio.
- **Exclusão em cascata**: ao deletar a transação principal, todos os itens associados são removidos via `onDelete: Cascade`.
- **Importação**: o CSV de fatura é processado pelo dialog `credit-card-invoice-dialog.tsx`, que cria o cabeçalho + itens em lote via `importCreditCardInvoice()`.

**Category:**
- Duplicidade verificada antes da criação via `findFirst({ where: { nome: { equals, mode: 'insensitive' }, userId, tipo } })` — case-insensitive.
- Se já existir, retorna o registro existente (idempotência).
- **Proteção de exclusão**: se `transactions.count > 0` vinculadas à categoria, o delete é bloqueado com mensagem específica.
- Também referenciada por `CreditCardInvoiceItem.categoria_id`.

**PaymentMethod & FinancialInstitution:**
- Duplicidade verificada via `findUnique({ where: { nome_userId } })` — usa a unique constraint composta.
- Mesma proteção de exclusão que categorias.

### 3.3 Agrupamento Inteligente de Categorias (`dashboard-utils.ts`)

A função `getCategoryGroupName()` normaliza nomes de categorias para grupos predefinidos:
- Se nome começa com "mercado" ou "mer" → `"Mercado"`
- Se nome começa com "comida", "restaurante" ou "ifood" → `"Alimentação"`
- Caso contrário → capitaliza primeira letra

Isso permite que "mercado extra", "mercado da esquina" e "mercadinho" sejam agregados sob "Mercado" no gráfico.

### 3.4 Server Actions — Padrão de Mutação

Todas as mutações seguem o mesmo padrão:

1. Verificar sessão via `getServerSession(authOptions)`.
2. Validar entrada com schema Zod (`.parse()`).
3. Executar operação no Prisma.
4. Chamar `revalidatePath("/dashboard")` e `revalidatePath("/reports")`.
5. Padrão de resposta: `{ success: true, data: { ...transaction, valor: Number(transaction.valor) } }` — **sempre converter Decimal para Number** antes de retornar.

**Transações de lote** (`csv-actions.ts:processBatchTransactions`):
- Usa `db.$transaction()` para criar múltiplos registros atomicamente.
- Após importação, cria automaticamente `MappingSuggestion` para aprendizado de categorização futura.

### 3.5 Cálculos do Dashboard

- Ao processar `categoryData`, o dashboard separa transações com `is_invoice_header === true` e as exclui do agrupamento, evitando duplicidade no gráfico. Em vez disso, busca os registros de `CreditCardInvoiceItem` e os mescla na agregação via `aggregateByCategory()`, garantindo que os gastos do cartão apareçam nas categorias corretas.

**`getDashboardData()` — `src/lib/dashboard.ts`:**

| Métrica | Fórmula |
|---------|---------|
| Saldo total | `totalEntradas - totalSaidas` |
| Delta | `((curr - prev) / prev) * 100` (se prev === 0 → 0) |
| Forecast | `(totalSaidas / diasPassados) * totalDiasNoMes` |
| Health Score | Se `entradas > 0`: `(saidas / entradas) * 100`. Se entradas === 0 e saídas > 0: 100. Senão: 0. |
| Categoria de Gastos | Filtra apenas `tipo === "SAIDA"`, agrupa via `getCategoryGroupName()` |

### 3.6 Autenticação e Segurança

- **Credentials Provider** com email + senha + código 2FA opcional.
- **2FA**: campo `status_2fa: Boolean` + `secret_2fa: String?` no modelo User. Se ativo, login exige segundo passo.
- **Registro**: email único verificado; senha hash com bcryptjs salt rounds = 10.
- **Seed automático**: ao registrar, cria 4 categorias padrão: Salário (ENTRADA), Alimentação, Transporte, Lazer (SAÍDAS).
- **Middleware** (`proxy.ts`): protege `/` e `/dashboard/*`; redireciona usuários logados para fora de `/auth/login`; verifica 2FA pendente.
- **Session strategy**: `jwt` — token armazena `id` do usuário, injetado na sessão via callbacks.

### 3.7 Navegação por URL Search Params

O componente `MonthPicker` gerencia estado de navegação exclusivamente via URL:
- Lê `searchParams.month` e `searchParams.year` da URL.
- Navegação (prev/next month) atualiza `?month=&year=` e usa `router.push()`.
- Server Components lêem os search params para buscar dados corretos.
- Isso garante que links possam ser compartilhados e bookmarked.

### 3.8 Processamento de CSV

- Parse com PapaParse (header: true, skipEmptyLines: true).
- Tenta mapear colunas por nome: `title/descricao`, `amount/valor`, `date/data`.
- Sugestão automática de categoria usando `MappingSuggestion` — busca por `search_term` contido no título.
- Valor usa `Math.abs()` para forçar positivo; sinal determina `tipo` (positivo = SAIDA, negativo = ENTRADA — note: comportamento invertido intencionalmente na lógica do CSV).
- **Bloqueio de submissão**: todas as linhas devem ter categoria atribuída.

---

## 4. Padrões de Design e UI/UX

### 4.1 Tema e Estilo Visual

- **Tema**: dual (light/dark) via `next-themes` + classe `.dark` no `<html>`.
- **Paleta base**: Neutral (`baseColor: "neutral"` no components.json) com CSS variables.
- **Identidade Dark**: fundos `slate-950`, cards `slate-900`, bordas `slate-800`, texto `slate-100/300`.
- **Identidade Light**: fundos `slate-50`, cards `white`, bordas `slate-200`, texto `slate-900`.
- **Destaques**: verde (`emerald`) para entradas/saúde financeira, vermelho (`rose`) para saídas, azul (`blue/indigo`) para links e ações.
- **Effects**: `backdrop-blur`, `shadow-2xl/shadow-lg`, `ring-1 ring-slate-200/800` em cards, `transition-all duration-500/300`, `hover:shadow-md`.
- **Tipografia**: `font-black tracking-tighter` em títulos, `uppercase tracking-wider` em labels, `font-mono` em códigos hex, `italic` em valores monetários.

### 4.2 Padrão de Cards

Cards do dashboard seguem consistência:
```
<Card className="border-none shadow-lg bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
```

O card de "Saldo Disponível" quebra o padrão: `bg-slate-950 text-white` com ícone decorativo grande e opacidade.

### 4.3 Navegação

- **TopNav**: barra fixa com backdrop-blur, botão "voltar" à esquerda, links Dashboard/Relatórios/Configurações à direita.
- **MonthPicker**: agrupado visualmente em container com background `slate-100/50` e bordas, com botões ChevronLeft/Right e Selects para mês/ano.
- **Responsividade**: padrão `flex flex-col md:flex-row` + `grid grid-cols-1 md:grid-cols-3`.

### 4.4 Componentes Reutilizáveis

**Combobox genérico** (`src/components/ui/combobox.tsx`):
- Popover com campo de busca, lista filtrável, opção "+ Criar" se `onAdd` for fornecido e termo não existir.
- Usado por: categorias e meios de pagamento.

**InstitutionCombobox** (`src/components/dashboard/institution-combobox.tsx`):
- Extensão do Combobox com criação via diálogo (nome + cor com seletor color picker).

**DatePicker** (`src/components/ui/date-picker.tsx`):
- Popover com Calendar do react-day-picker, locale ptBR, formato `"dd - MMM - yyyy"`.

### 4.5 Feedback ao Usuário

- **Toasts**: Sonner com `richColors` e posição `top-right`.
- **Loading states**: `useTransition` + ícone `Loader2` com `animate-spin` em botões de submit.
- **Empty states**: mensagens centrais em itálico com ícones decorativos.
- **Validation feedback**: erros inline em vermelho abaixo de cada campo + Alert destrutivo no topo do formulário.
- **Diálogos**: transições suaves com backdrop-blur, bordas semi-transparentes.

### 4.6 Tratamento de Erros em Server Actions

Todas as Server Actions usam `try/catch` com:
```typescript
console.error("Error creating transaction:", error);
throw new Error(error.message || "Erro ao criar transação");
```

Erros de unique constraint no Prisma (código `P2002`) são tratados especificamente com mensagem amigável em português.

### 4.7 Exportação

- Dropdown com opções CSV e PDF.
- Atualmente **mock** (`alert()`), estrutura preparada para implementação futura.

---

## 5. Convenções de Código

### 5.1 Nomenclatura

- **Pastas**: `kebab-case` para diretórios de componentes de UI.
- **Arquivos**: `kebab-case.tsx` para componentes, `camelCase.ts` para utilitários.
- **Funções**: `camelCase` para funções utilitárias, `PascalCase` para componentes React.
- **Modelos Prisma**: `PascalCase` (Transaction, Category), campos em `snake_case`.

### 5.2 Imports

- Path alias `@/` → `src/` para todos os imports internos.
- Componentes de UI importados de `@/components/ui/...`.
- Server Actions importadas de `@/lib/actions` (ou específicas como `@/lib/csv-actions`).
- Schemas de `@/lib/validations`.

### 5.3 Separação Server/Client

| Critério | Server Component | Client Component |
|----------|-----------------|------------------|
| Busca de dados | ✅ `async` + `getServerSession()` | ❌ |
| Server Actions | ✅ `"use server"` | ❌ |
| Interatividade (onClick, useState, useEffect) | ❌ | ✅ `"use client"` |
| Hooks (useRouter, useForm, useTransition) | ❌ | ✅ |
| Recharts, Sonner | ❌ | ✅ |

