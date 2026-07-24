# Contexto do Projeto: NxFinance

> Documento técnico de referência para IAs e desenvolvedores. Reflete o estado real do código na branch atual (`feature/2026-07-23_melhoria_tela`, derivada de `staging`). Não documenta features de outras branches não mergeadas — ver seção 6.

## 1. Stack Tecnológica Principal

| Camada | Tecnologia | Versão | Observação |
|--------|-----------|--------|------------|
| Framework | Next.js (App Router) | ^16.2.2 | `src/app/` com Server Components por padrão |
| Linguagem | TypeScript | ^5.6.3 | Strict mode, path alias `@/` → `src/` |
| ORM | Prisma | ^6.0.1 | PostgreSQL via `DATABASE_URL`, engine classic |
| Banco | PostgreSQL | — | Provider configurado no `schema.prisma`; sync via `prisma db push` (sem `migrate deploy` em produção) |
| UI Primitives | shadcn/ui | New York | Componentes via `@/components/ui/`, estilo `new-york` |
| Estilização | Tailwind CSS | ^3.4.15 | Config com `tailwindcss-animate`, CSS variables via `globals.css` |
| Autenticação | NextAuth | ^4.24.13 | Credentials Provider, JWT session strategy, sem adapter (sessão 100% JWT) |
| 2FA (TOTP) | otplib + qrcode | ^13.4.1 / ^1.5.4 | TOTP real (RFC 6238) via API funcional do otplib v13 (`generateSecret`/`generateURI`/`verify`); QR code de setup via `qrcode` |
| Formulários | react-hook-form | ^7.71.2 | Integrado com `@hookform/resolvers` + Zod |
| Validação | Zod | ^4.3.6 | Schemas em `src/lib/validations.ts` |
| Gráficos | Recharts | ^2.13.3 | Pie/Donut charts no dashboard |
| Datas | date-fns | ^4.1.0 | Locale `ptBR` para formatação em português |
| Calendário | react-day-picker | ^9.14.0 | Componente DatePicker |
| Cálculos | decimal.js | ^10.6.0 | Precisão financeira em parcelamentos |
| Ícones | Lucide React | ^0.460.0 | Ícones nos componentes de UI |
| Tabelas | @tanstack/react-table | ^8.21.3 | Tabela de relatórios |
| Tema | next-themes | ^0.4.3 | dark/light/system via classe `.dark` |
| Notificações | Sonner | ^2.0.7 | Toasts rich colors, posição top-right |
| CSV | PapaParse | ^5.5.3 | Importação em lote |
| Senhas | bcryptjs | ^3.0.3 | Hash de senhas (salt rounds = 10) |
| Radix UI | @radix-ui/* | — | 9 componentes: avatar, dialog, dropdown-menu, label, popover, progress, select, slot, tabs |
| Outros | dompurify, cmdk (^1.1.1), class-variance-authority, clsx, tailwind-merge, reflect-metadata | — | Sanitização, command palette, variants CSS, reflexão |

**Scripts de build:**
```
dev         → next dev
build       → prisma generate && next build
start       → next start
lint        → next lint
postinstall → prisma generate
```

**Configurações notáveis:**
- `tsconfig.json`: strict mode, path alias `@/` → `src/`, target ES2017, moduleResolution bundler
- `next.config.ts`: output `standalone`
- `components.json`: shadcn/ui style `new-york`, baseColor `neutral`, CSS variables habilitadas
- `postcss.config.js`: Tailwind CSS + Autoprefixer
- `prisma.config.ts`: engine `classic`
- `prisma/migrations/`: contém apenas uma pasta vazia (`20260717041037_add_provisionamento_fatura`, sem `migration.sql`) — resíduo de uma feature branch não mergeada. Não afeta o deploy, pois o fluxo usa `prisma db push`, não `prisma migrate deploy`.
- `.gitattributes`: força `eol=lf` (geral e em `*.sh`) — evita que o Windows reintroduza CRLF no `docker-entrypoint.sh` via checkout (`core.autocrlf`), o que quebra o shebang dentro do container Linux.

**Infraestrutura:**
- `Dockerfile`: multi-stage build (node:20-alpine, standalone output); define `DATABASE_URL` placeholder antes de `prisma generate`/`next build` (o valor real só existe em runtime, via docker-compose); usa `--chown=nextjs:nodejs` nas cópias do runner stage para o usuário não-root conseguir rodar `prisma db push` no entrypoint
- `docker-compose.yml`: serviço PostgreSQL 15 + app Next.js
- `docker-entrypoint.sh`: executa `prisma db push --accept-data-loss` antes de iniciar (LF — ver `.gitattributes` acima)
- `.env.example`: template com variáveis `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**CI/CD:**
- `.github/workflows/db-sync.yml`: sincroniza schema Prisma ao fazer push em staging/main

---

## 2. Arquitetura e Mapeamento de Arquivos

### `src/app/` — Rotas e Layouts (App Router)

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `layout.tsx` | Server Component | RootLayout: `<html lang="pt-BR">`, Providers, EnvironmentBanner, `CommandPalette`, `MobileBottomNav`, Toaster Sonner |
| `providers.tsx` | Client Component | Wrapper: SessionProvider + ThemeProvider (attribute="class", defaultTheme="system", enableSystem) |
| `page.tsx` | Server Component | Dashboard principal (rota `/`): sessão → busca dados → envolve o conteúdo em `PrivacyProvider` → renderiza cards, gráficos, transações (ou `EmptyDashboardState` se o usuário nunca lançou nada) |
| `globals.css` | Estilos | Definição de CSS variables para `:root` (light) e `.dark`; `@tailwind base/components/utilities` |
| `auth/login/page.tsx` | Client Component | Formulário de login com suporte a 2FA (campo `code` aparece condicionalmente quando o servidor responde `2FA_REQUIRED`) |
| `auth/register/page.tsx` | Client Component | Formulário de registro → chama `registerUser()` Server Action |
| `reports/page.tsx` | Server Component | Página de relatórios: busca dados + renderiza `ReportContent` + `MonthPicker` |
| `reports/report-content.tsx` | Client Component | Tabela paginada (50/página) com filtragem por status/categoria/instituição/meio de pagamento |
| `reports/report-filters.tsx` | Client Component | Filtros combinados com Selects com totais por meio de pagamento |
| `dashboard/settings/page.tsx` | Server Component | Tabs de configuração: Instituições (default), Categorias, Meios de Pagamento, Segurança (2FA) |
| `api/auth/[...nextauth]/route.ts` | Route Handler | Catch-all NextAuth: exporta GET/POST handler |

### `src/components/dashboard/` — Componentes de Negócio

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `summary-cards.tsx` | Client Component | 3 cards de KPI: Saldo (hero, fundo escuro, badge de tendência), Entradas (`emerald-600/400`), Saídas (`rose-600/400`) — valores mascaráveis via `useIsPrivacyMode()` |
| `category-chart.tsx` | Client Component | Gráfico donut Recharts limitado a 10 fatias + "Outros"; legenda lista **todas** as categorias sem cap, cada uma na própria linha; clique (na fatia ou na legenda) abre diálogo de detalhe — se for "Outros", a lista de despesas vem agrupada por categoria |
| `recent-transactions.tsx` | Client Component | Lista de transações do mês separada por Entradas/Saídas; valores mascaráveis |
| `month-picker.tsx` | Client Component | Navegador de mês/ano via URL Search Params (`?month=&year=`); botões com hitbox de 44px; `useTransition` com feedback visual (pulso/disable) durante a navegação |
| `transaction-form.tsx` | Client Component | Formulário completo com suporte a parcelamento (`decimal.js`), Combobox com criação inline |
| `new-transaction-dialog.tsx` | Client Component | Diálogo para nova transação, carrega dados ao abrir |
| `edit-transaction-dialog.tsx` | Client Component | Diálogo de edição com `initialData` |
| `quick-pay-button.tsx` | Client Component | Botão de pagamento rápido (altera status para PAGO) |
| `csv-import-dialog.tsx` | Client Component | Importação CSV em 2 passos: upload + mapeamento de categorias, com sugestão automática por `MappingSuggestion` |
| `credit-card-invoice-dialog.tsx` | Client Component | Importação de fatura de cartão de crédito via CSV: cria cabeçalho `is_invoice_header` + itens detalhados com categoria; aceita valores negativos (estorno/reembolso, reduzem o total da fatura); sugestão automática de categoria com destaque visual sutil (sem badge de texto) |
| `institution-combobox.tsx` | Client Component | Combobox especializado com criação de instituição via diálogo |
| `export-buttons.tsx` | Client Component | Dropdown de exportação real: CSV (`;`-delimitado, BOM UTF-8 p/ Excel pt-BR) via Blob + `<a download>`, e PDF via janela de impressão (`window.print()`) |
| `financial-health.tsx` | Client Component | Indicador visual de saúde financeira com Progress |
| `forecast.tsx` | Client Component | Projeção mensal baseada em média diária |
| `settings-forms.tsx` | Client Component | Linhas editáveis para renomear/excluir registros auxiliares |
| `security-settings.tsx` | Client Component | Ativação/desativação de 2FA: gera QR code de setup, confirma com código de 6 dígitos |
| `empty-dashboard-state.tsx` | Server Component | Estado vazio (usuário sem nenhuma transação): CTAs reaproveitando `NewTransactionDialog`/`CsvImportDialog`/`CreditCardInvoiceDialog` |
| `monthly-trend-chart.tsx` | Client Component | Área Recharts com saldo dos últimos 6 meses (gradiente) |
| `privacy-provider.tsx` | Client Component | `PrivacyProvider` (Context + `localStorage`) e `PrivacyToggleButton` — toggle de olho para ocultar/exibir valores monetários no dashboard; hook `useIsPrivacyMode()` |

### `src/components/layout/` — Componentes de Layout

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `top-nav.tsx` | Client Component | Barra de navegação superior fixa com backdrop-blur; logo linka pra `/`; gatilho de busca central (abre `CommandPalette`); links Dashboard/Relatórios/Configurações ocultos em mobile (`hidden sm:flex` — substituídos pelo `MobileBottomNav`) |
| `mobile-bottom-nav.tsx` | Client Component | Barra fixa inferior (`sm:hidden`) com os mesmos links de navegação, para mobile; oculta em rotas `/auth/*` |

### `src/components/` — Outros Componentes

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `environment-banner.tsx` | Server Component | Banner "AMBIENTE DE HOMOLOGAÇÃO" laranja; oculto apenas quando `NODE_ENV === "production"` (ou `NEXT_PUBLIC_VERCEL_ENV === "production"`) **e** `DATABASE_URL` contém `/nxfinance` |
| `theme-toggle.tsx` | Client Component | Dropdown de tema (Claro/Escuro/Sistema) com ícones Sun/Moon |
| `command-palette.tsx` | Client Component | Busca global (Cmd/Ctrl+K ou clique no gatilho do `TopNav`) sobre `searchTransactions()`, debounce de 300ms; exporta `OPEN_COMMAND_PALETTE_EVENT` |

### `src/components/ui/` — Primitivas shadcn/ui

`alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `combobox`, `command` (cmdk, usado pelo `CommandPalette`), `date-picker`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `select`, `skeleton`, `switch`, `table`, `tabs`

### `src/lib/` — Lógica Compartilhada

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `utils.ts` | Utilitário | `cn()` (merge de classes Tailwind); `formatCurrency()`/`maskCurrency()` (formatação BRL centralizada — usado por todo o dashboard); `getErrorMessage()`/`getPrismaErrorMessage()` (mensagens amigáveis para erros do Prisma: P2002/P2025/P2003) |
| `validations.ts` | Schema | Schemas Zod: `transactionSchema`, `categorySchema`, `paymentMethodSchema`, `financialInstitutionSchema`, `loginSchema`, `registerSchema`, `twoFactorCodeSchema`, `creditCardInvoiceSchema`, `creditCardInvoiceItemSchema` (valor aceita negativo — estorno/reembolso) |
| `actions.ts` | Server Actions | CRUD de transações, categorias, métodos de pagamento, instituições financeiras |
| `auth-actions.ts` | Server Action | `registerUser()` — registro + seed de categorias padrão |
| `auth.ts` | Config | `authOptions` — NextAuth config com Credentials Provider; `authorize()` valida o código TOTP (via `otplib`, `epochTolerance: 30`) contra `secret_2fa` quando `status_2fa` está ativo |
| `two-factor-actions.ts` | Server Actions | `generateTwoFactorSetup()` (gera segredo + QR code, não persiste), `enableTwoFactor()`/`disableTwoFactor()` (validam o código antes de gravar `status_2fa`/`secret_2fa`) |
| `dashboard.ts` | Server Actions | `getDashboardData()` — agrega totais, deltas, health score, forecast, smart category grouping, `hasAnyTransactions`; `getMonthlyTrend()` — saldo dos últimos 6 meses em buckets mensais |
| `dashboard-utils.ts` | Utilitário | `getCategoryGroupName()` (sinônimos hardcoded: mercado/mer, comida/restaurante/ifood); `mergeSimilarCategories()` (merge genérico por prefixo normalizado, cobre variações não previstas nos sinônimos); `capToTopNPlusOthers()` (cap fixo + fatia "Outros"); `getMerchantSignature()` (assinatura de 2 palavras p/ aprendizado de `MappingSuggestion`) |
| `reports.ts` | Server Actions | `getReportData()`, `getCategories/PaymentMethods/Institutions()`, `searchTransactions()` (usado pelo `CommandPalette`, se autentica via `getServerSession`) |
| `credit-card-actions.ts` | Server Actions | `importCreditCardInvoice()` — importa fatura CSV (soma sinalizada: estornos reduzem o total; bloqueia se total ≤ 0), aprende `MappingSuggestion` por item, + `getInvoiceItems()` + `getInvoiceHeaders()` |
| `csv-actions.ts` | Server Actions | `processBatchTransactions()`, `getMappingSuggestions()`, `saveMappingSuggestion()` — casamento/aprendizado via `getMerchantSignature()` |
| `db.ts` | Singleton | Instância singleton do PrismaClient (cache em `globalThis`) — **usado por todas as Server Actions** |

### `src/proxy.ts` — Middleware

| Arquivo | Propósito |
|---------|-----------|
| `src/proxy.ts` | Middleware NextAuth `withAuth`: protege `/` e `/dashboard/*`; redireciona usuários logados para fora de `/auth/login`/`/auth/register`. O 2FA é validado inteiramente dentro de `authorize()` (antes do JWT existir) — não há estado "logado mas pendente de 2FA" a checar aqui (a lógica morta que checava isso foi removida) |

**Matcher:** `["/", "/dashboard/:path*", "/auth/:path*"]`

### `src/types/` — Extensões de Tipo

| Arquivo | Propósito |
|---------|-----------|
| `next-auth.d.ts` | Estende `Session.user.id`, `User.id`, `JWT.id` |

---

## 3. Regras de Negócio Implementadas

### 3.1 Validação e Transformação de Dados (Zod)

Todos os schemas em `src/lib/validations.ts` aplicam transformações **antes** de persistir:

- **Capitalização automática**: campos `nome` e `descricao` sofrem `.transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase())` — isso garante que "ALUGUEL" → "Aluguel", "mercado" → "Mercado".
- **Valor monetário**: `z.coerce.number().positive("Valor deve ser positivo")` — rejeita zero e negativos, **exceto** `creditCardInvoiceItemSchema`, que só rejeita zero (`.refine(v => v !== 0)`) — valores negativos representam estorno/reembolso no item da fatura.
- **Datas**: `z.coerce.date()` — aceita strings ISO e converte.
- **Cores**: `z.string().regex(/^#[0-9A-F]{6}$/i)` — valida formato hexadecimal (ex: `#10b981`). `financialInstitutionSchema` permite cor vazia opcional.
- **Unique constraints**: `@@unique([nome, userId, tipo])` no Prisma para categorias; `@@unique([nome, userId])` para métodos de pagamento e instituições.
- **Refinements**: `transactionSchema` usa `.refine()` para exigir `installmentsCount` quando `isInstallment === true`.

### 3.2 Comportamento Específico por Entidade

**Transaction:**
- `data_lancamento` tem `@default(now())` — sempre registra a data de criação automaticamente.
- `data_pagamento` é opcional (`DateTime?`) — preenchida com `new Date()` por `payTransaction()` em `actions.ts` ao liquidar.
- Status padrão é `PENDENTE`.
- Ao criar uma transação parcelada (`isInstallment === true`):
  - O valor total é dividido usando `decimal.js` com `ROUND_DOWN` e precisão de 2 casas decimais.
  - A última parcela absorve o centavo residual: `lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1))`.
  - Cada parcela recebe data de vencimento incremental: `addMonths(dataVencimento, index)`.
  - Nomes das parcelas seguem o padrão `"Descrição (01/12)"` editável pelo usuário via `installmentDescriptions`.
  - **O parcelamento só está disponível para `tipo === "SAIDA"`** e apenas na criação (não edição — `updateTransaction` descarta `isInstallment`/`installmentsCount`).
- Status `ATRASADO` é **calculado dinamicamente** no servidor: se `status !== "PAGO" && dataVencimento < now()`, o status exibido é "ATRASADO" (não é persistido, apenas calculado na query em `dashboard.ts` e `reports.ts`).

**CreditCardInvoiceItem (modelo auxiliar de fatura de cartão):**
- Relacionamento 1:N com Transaction via `transactionId` — uma transação `is_invoice_header` pode conter N itens.
- `data_vencimento_original` (opcional) armazena a data de vencimento individual do item (se diferente da fatura) — campo existe no schema mas não é preenchido pelo fluxo de importação atual (`importCreditCardInvoice` não define esse valor).
- `categoria_id` vincula cada item a uma Category, permitindo agregação no gráfico de categorias.
- **Liquidação unificada**: apenas a transação principal (`is_invoice_header`) é liquidada (status → PAGO). Os itens não possuem status próprio.
- **Exclusão em cascata**: ao deletar a transação principal, todos os itens associados são removidos via `onDelete: Cascade`.
- **Importação**: o CSV de fatura é processado pelo dialog `credit-card-invoice-dialog.tsx`, que cria cabeçalho + itens em lote via `importCreditCardInvoice()`. A categoria "Fatura Cartão" (`#6366f1`, ícone CreditCard) é auto-criada se não existir, apenas para satisfazer a FK do cabeçalho (é excluída da agregação do gráfico).
- **Estorno/reembolso**: itens com valor negativo são aceitos e preservados (sinal mantido do parse até a gravação — sem `Math.abs()`); o total da fatura é a soma sinalizada dos itens, e a importação é bloqueada (`throw`) se o total ficar ≤ 0 (estornos superando as compras). Telas que exibem sub-itens de fatura (relatórios, lançamentos recentes) tratam o sinal explicitamente para não duplicar o "−" na formatação.
- **Aprendizado de categoria**: após criar os itens, `importCreditCardInvoice()` faz `upsert` de `MappingSuggestion` por item (assinatura via `getMerchantSignature()`), para sugerir automaticamente a categoria em importações futuras do mesmo estabelecimento.
- **Exibição em relatórios/dashboard**: invoice items são expandidos como sub-linhas na tabela de relatórios e mesclados no gráfico de categorias (evitando dupla contagem da transação `is_invoice_header`).
- **Não há conciliação automática de parcelamentos** contra a fatura importada (sem regex/matching por descrição, sem tolerância de valor) — cada item da fatura é lançado manualmente com sua própria categoria no momento da importação.

**Category:**
- Duplicidade verificada antes da criação via `findFirst({ where: { nome: { equals, mode: 'insensitive' }, userId, tipo } })` — case-insensitive.
- Se já existir, retorna o registro existente (idempotência).
- **Proteção de exclusão**: se `transactions.count > 0` vinculadas à categoria, o delete é bloqueado com mensagem específica.
- Também referenciada por `CreditCardInvoiceItem.categoria_id`.

**PaymentMethod & FinancialInstitution:**
- Duplicidade verificada via `findUnique({ where: { nome_userId } })` — usa a unique constraint composta.
- Mesma proteção de exclusão que categorias.
- `FinancialInstitution` possui campo `metadata` (JSON, default `{}`) e `cor` opcional.

### 3.3 Agrupamento Inteligente de Categorias (`dashboard-utils.ts`)

Duas camadas, aplicadas em pontos diferentes do pipeline:

1. **`getCategoryGroupName()`** — roda **server-side**, dentro de `aggregateByCategory()` em `dashboard.ts`. Mapeia sinônimos hardcoded (nomes semanticamente iguais, mas grafias diferentes):
   - Se nome começa com "mercado" ou "mer" → `"Mercado"`
   - Se nome começa com "comida", "restaurante" ou "ifood" → `"Alimentação"`
   - Caso contrário → capitaliza a primeira letra
2. **`mergeSimilarCategories()`** — roda **client-side**, em `category-chart.tsx`, sobre o resultado já agrupado do passo 1. Generaliza para categorias quase-duplicadas que o dicionário de sinônimos não cobre (ex.: `"Transp"` e `"Transporte"` como duas `Category` distintas no banco, já que o nome só é único por usuário+tipo): normaliza acento/caixa (NFD) e funde buckets quando o nome normalizado de um é prefixo do outro (mínimo 3 caracteres); o nome canônico exibido é sempre a variante mais completa. Cada bucket resultante carrega `sourceNames: string[]` com os nomes brutos agrupados, usado depois para o filtro do diálogo de detalhe.
3. **`capToTopNPlusOthers()`** — também client-side, aplicado só ao donut (não à legenda): mantém as top 10 categorias por valor + soma o restante numa fatia `"Outros"` (cor fixa neutra), para a pizza não ficar ilegível com muitas fatias finas. A legenda abaixo do gráfico lista **todas** as categorias sem esse cap, cada uma na própria linha.

O clique num item (fatia do donut ou linha da legenda) abre um diálogo com as transações daquela categoria; se for a fatia "Outros", a lista vem agrupada por categoria (com subtotal por grupo) em vez de uma lista plana.

### 3.4 Server Actions — Padrão de Mutação

Todas as mutações seguem o mesmo padrão:

1. Verificar sessão via `getServerSession(authOptions)` (ou `getUserId()` helper local a cada arquivo).
2. Validar entrada com schema Zod (`.parse()`).
3. Executar operação no Prisma.
4. Chamar `revalidatePath("/dashboard")` e `revalidatePath("/reports")`.
5. Padrão de resposta: `{ success: true, data: { ...transaction, valor: Number(transaction.valor) } }` — **sempre converter Decimal para Number** antes de retornar.

**Transações de lote** (`csv-actions.ts:processBatchTransactions`):
- Usa `db.$transaction()` para criar múltiplos registros atomicamente.
- Após importação, cria automaticamente `MappingSuggestion` para aprendizado de categorização futura.

**MappingSuggestion:**
- Modelo auxiliar com unique `@@unique([search_term, userId])`.
- Usa `upsert` para criar ou atualizar sugestão (`saveMappingSuggestion`), tanto no import de CSV genérico quanto no de fatura de cartão (`importCreditCardInvoice`).
- `search_term` é uma **assinatura de estabelecimento** (`getMerchantSignature()`, em `dashboard-utils.ts`): normaliza o texto (minúsculas, remove acento/dígitos/pontuação) e usa as 2 primeiras palavras significativas — não o título bruto inteiro. Isso é necessário porque extratos reais variam número de referência/cidade/data a cada lançamento do mesmo estabelecimento; comparar substring do título inteiro (abordagem antiga) quase nunca batia de novo. O casamento na tela de importação é por **igualdade exata** da assinatura (`s.search_term === getMerchantSignature(title)`), não mais `includes()`.
- Quando uma linha é pré-preenchida por sugestão, a UI marca o campo de categoria com um tom sutil (sem badge de texto); se o usuário mudar a categoria manualmente, a marcação some.

### 3.5 Cálculos do Dashboard

- Ao processar `categoryData`, o dashboard separa transações com `is_invoice_header === true` e as exclui do agrupamento, evitando duplicidade no gráfico. Em vez disso, busca os registros de `CreditCardInvoiceItem` e os mescla na agregação via `aggregateByCategory()`, garantindo que os gastos do cartão apareçam nas categorias corretas.
- Invoice items também são mapeados para estrutura similar a transação (`invoiceItemsAsTransactions`) para inclusão em `monthlyTransactions` e exibição no gráfico/diálogo de detalhes.

**`getDashboardData()` — `src/lib/dashboard.ts`:**

| Métrica | Fórmula |
|---------|---------|
| Saldo total | `totalEntradas - totalSaidas` |
| Delta | `((curr - prev) / prev) * 100` (se prev === 0 → 0) |
| Forecast | `(totalSaidas / diasPassados) * totalDiasNoMes` |
| Health Score | Se `entradas > 0`: `(saidas / entradas) * 100`. Se entradas === 0 e saídas > 0: 100. Senão: 0. |
| Categoria de Gastos | Filtra apenas `tipo === "SAIDA"`, agrupa via `getCategoryGroupName()` |

**`getMonthlyTrend()` — `src/lib/dashboard.ts`:** retorna o saldo (entradas − saídas) dos últimos 6 meses em buckets mensais, usado pelo `MonthlyTrendChart`.

### 3.6 Autenticação e Segurança

- **Credentials Provider** com email + senha + código 2FA (obrigatório apenas se `status_2fa === true`).
- **Registro**: email único verificado; senha hash com bcryptjs salt rounds = 10.
- **Seed automático**: ao registrar, cria 4 categorias padrão: Salário (ENTRADA, `#10b981`, Wallet), Alimentação (SAIDA, `#f43f5e`, Utensils), Transporte (SAIDA, `#3b82f6`, Car), Lazer (SAIDA, `#f59e0b`, Gamepad2).
- **Session strategy**: `jwt` — callback `jwt()` só injeta `token.id`; callback `session()` só injeta `session.user.id`.
- **API Route**: `src/app/api/auth/[...nextauth]/route.ts` — handler NextAuth (GET/POST).
- **2FA — TOTP funcional de ponta a ponta**:
  - Ativação: aba "Segurança" em `/dashboard/settings` (`security-settings.tsx`) → `generateTwoFactorSetup()` gera segredo + QR code (não persiste) → usuário escaneia com app autenticador → confirma com código de 6 dígitos → `enableTwoFactor()` valida o código e só então grava `status_2fa = true` + `secret_2fa`.
  - Login: se `status_2fa` do usuário for `true`, `authorize()` (`auth.ts`) exige o campo `code` (senão lança `"2FA_REQUIRED"`, tratado pela UI de login pra exibir o campo) e valida via `verify()` do `otplib` com `epochTolerance: 30` (1 time-step de tolerância de relógio, pra frente e pra trás) contra `secret_2fa`.
  - Desativação: `disableTwoFactor()` também exige um código válido antes de limpar `status_2fa`/`secret_2fa`.
  - Não há envio de e-mail nem rota `/auth/verify-2fa` — o código é sempre inserido no próprio formulário de login (campo condicional), não em uma etapa separada.

### 3.7 Navegação por URL Search Params

O componente `MonthPicker` gerencia estado de navegação exclusivamente via URL:
- Lê `searchParams.month` e `searchParams.year` da URL.
- Navegação (prev/next month, Selects) chama `router.push()` dentro de `startTransition()`; enquanto `isPending`, o próprio controle fica com opacidade reduzida/pulsando e desabilitado — feedback visual local, sem lifting de estado pros componentes irmãos (`SummaryCards`, `CategoryChart` etc.).
- Server Components lêem os search params para buscar dados corretos — a recarga dos dados é automática via re-render do Server Component `page.tsx`, não exige wiring extra.
- Isso garante que links possam ser compartilhados e bookmarked.
- Botões de navegação (setas prev/next) têm hitbox de 44px (`h-11 w-11`), adequada para toque em mobile.

### 3.8 Processamento de CSV (genérico, `csv-import-dialog.tsx`)

- Parse com PapaParse (`header: true`, `skipEmptyLines: true`).
- Tenta mapear colunas por nome: `title/descricao/description`, `amount/valor/Value`, `date/data/Date`.
- Sugestão automática de categoria usando `MappingSuggestion` — busca por `search_term` contido no título.
- Valor usa `Math.abs()` para forçar positivo; **sinal do valor bruto define `tipo`**: `amount >= 0 → SAIDA`, `amount < 0 → ENTRADA` (`csv-import-dialog.tsx:176`).
- **Bloqueio de submissão**: todas as linhas devem ter categoria atribuída.
- Este fluxo é independente do de fatura de cartão (`credit-card-invoice-dialog.tsx`), que tem seu próprio schema (`creditCardInvoiceSchema`) e sempre grava `is_invoice_header = true` + itens.

### 3.9 Toggle de Privacidade (`privacy-provider.tsx`)

- `PrivacyProvider` envolve o conteúdo de `src/app/page.tsx`; guarda um boolean (`isHidden`) em Context + `localStorage` (chave `nxfinance:dashboard-privacy`), inicializado em `false` no primeiro render (SSR-safe) e corrigido a partir do `localStorage` num `useEffect` no mount do cliente.
- `PrivacyToggleButton` (ícone Eye/EyeOff) fica ao lado do `ThemeToggle` no cabeçalho do dashboard.
- `useIsPrivacyMode()` é consumido por `SummaryCards` (os 3 KPIs), `CategoryChart` (total central do donut) e `RecentTransactions` (valor de cada lançamento/sub-item de fatura), todos passando o valor por `maskCurrency(value, isHidden)` — que retorna `"••••••"` quando oculto. Legenda de categorias e diálogos de detalhe **não** são mascarados (escopo confirmado do recurso).

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

O card de "Saldo Disponível" quebra o padrão: `bg-slate-950 text-white` com ícone decorativo grande e opacidade, e um `Badge` de tendência com tom suave (`bg-emerald/rose-500/10`) em vez do texto solto.

### 4.3 Navegação

- **TopNav** (`src/components/layout/top-nav.tsx`): barra fixa com backdrop-blur; logo à esquerda linka pra `/` (sem botão "voltar"); gatilho de busca central que abre o `CommandPalette` (Ctrl/Cmd+K); links Dashboard/Relatórios/Configurações à direita com active state via `pathname`, ocultos em mobile (`hidden sm:flex`).
- **MobileBottomNav**: barra fixa inferior (`sm:hidden`) substituindo os links do TopNav em telas pequenas.
- **CommandPalette**: busca global de transações (Ctrl/Cmd+K ou clique no gatilho do TopNav), debounce de 300ms sobre `searchTransactions()`.
- **MonthPicker**: agrupado visualmente em container com background `slate-100/50` e bordas, com botões ChevronLeft/Right (hitbox 44px) e Selects para mês/ano; pulso/opacidade reduzida durante a navegação (`useTransition`).
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

Todas as Server Actions usam `try/catch` com `console.error(...)` seguido de `throw new Error(getPrismaErrorMessage(error, "..."))` — `getPrismaErrorMessage()` (`src/lib/utils.ts`) traduz códigos comuns do Prisma (`P2002` unique constraint, `P2025` not found, `P2003` FK inválida) para mensagens amigáveis em português, com fallback para `getErrorMessage()`.

### 4.7 Exportação

- Dropdown com opções CSV e PDF, ambas funcionais (`export-buttons.tsx`).
- **CSV**: monta conteúdo `;`-delimitado com BOM UTF-8 (compatibilidade com Excel pt-BR), gera via `Blob` + `<a download>`.
- **PDF**: abre uma nova janela com uma tabela HTML formatada e chama `window.print()`.

### 4.8 Banner de Ambiente

`EnvironmentBanner` (`src/components/environment-banner.tsx`):
- Exibe banner laranja "AMBIENTE DE HOMOLOGAÇÃO - OS DADOS NÃO SÃO REAIS" quando **não** (`produção` E banco oficial `/nxfinance`) — ver condição exata em 2.
- Oculta apenas em produção com banco oficial.

### 4.9 Toggle de Privacidade

- Ícone Eye/EyeOff (`PrivacyToggleButton`) ao lado do `ThemeToggle`, no cabeçalho do dashboard — oculta/exibe valores monetários dos 3 KPIs, do total central do gráfico de categorias e da lista de lançamentos recentes. Estado persiste em `localStorage` (ver 3.9).

---

## 5. Convenções de Código

### 5.1 Nomenclatura

- **Pastas**: `kebab-case` para diretórios de componentes de UI.
- **Arquivos**: `kebab-case.tsx` para componentes, `camelCase.ts` para utilitários.
- **Funções**: `camelCase` para funções utilitárias, `PascalCase` para componentes React.
- **Modelos Prisma**: `PascalCase` (Transaction, Category), campos em `snake_case`.

### 5.2 Imports

- Path alias `@/` → `src/` para todos os imports internos (preferência). **Nota:** alguns arquivos (ex: login page, root dashboard page) ainda usam imports relativos — inconsistência conhecida.
- Componentes de UI importados de `@/components/ui/...`.
- Server Actions importadas de `@/lib/actions` (ou específicas como `@/lib/csv-actions`).
- Schemas de `@/lib/validations`.

### 5.3 Separação Server/Client

| Característica | Server Component | Client Component |
|----------------|-----------------|------------------|
| Busca de dados | ✅ `async` + `getServerSession()` | ❌ |
| Server Actions (chamada) | ✅ import e call direto | ✅ via transition/hook |
| Interatividade (onClick, useState, useEffect) | ❌ | ✅ `"use client"` |
| Hooks (useRouter, useForm, useTransition) | ❌ | ✅ |
| Recharts, Sonner | ❌ | ✅ |
| *Directiva de arquivo* | *nenhuma* | `"use client"` |

> **Nota:** Server Actions são funções assíncronas com `"use server"` no topo do arquivo. Elas podem ser importadas e chamadas tanto por Server Components quanto por Client Components.

---

## 6. Gaps e Inconsistências Conhecidas

Seção para evitar que futuras sessões assumam que algo funciona apenas porque há código relacionado no repositório.

- **`CreditCardInvoiceItem.data_vencimento_original`** existe no schema mas não é escrito pelo fluxo de importação atual.
- **Sem conciliação assistida de fatura de cartão**: não há matching automático (regex/tolerância) entre itens de fatura importados e parcelamentos futuros já lançados — cada item da fatura é categorizado manualmente na importação.
- **Sem provisão de despesas fixas → despesa real**: não existe, na branch atual, fluxo de "provisão" com transição de status para lançamento efetivo. Essas duas últimas features (conciliação assistida e provisão de despesas) existem implementadas na branch `feature/2026-07-18_prev-desc-new_table` (não mergeada) — consultar essa branch antes de reimplementar do zero.
- **Legenda do gráfico de categorias não é mascarada pelo toggle de privacidade**: só o total central do donut e os 3 KPIs/lista de lançamentos são mascarados — decisão de escopo, não bug (ver 3.9).
- **`db-sync.yml`** aplica `prisma db push` direto contra o banco de produção/staging a cada push nessas branches, sem histórico de migração — mudanças de schema que impliquem perda de dados (drop de coluna/tabela não vazia) bloqueiam o workflow até alguém decidir manualmente entre `--accept-data-loss` ou uma correção manual no banco (ex.: rename).

**Já resolvido nesta branch (histórico, para não reabrir por engano):** 2FA agora é TOTP funcional de ponta a ponta (ver 3.6); `prisma.ts`, `mail.ts`/`mail.js` e o `dashboard/page.tsx` mock foram removidos (código morto); `export-buttons.tsx` exporta CSV/PDF de verdade; `data_pagamento` é preenchido por `payTransaction()`; `@auth/prisma-adapter` e `nodemailer` foram removidos do `package.json`.
