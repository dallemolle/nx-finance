# Auditoria Técnica — NxFinance

> Checklist de acompanhamento. Atualizado a cada rodada de trabalho — abra este arquivo diretamente para ver o andamento, sem precisar consultar o histórico de chat.

## Contexto

Auditoria completa do projeto (Next.js 16 + TypeScript + Prisma/PostgreSQL) sob 4 pilares: Arquitetura/Server Actions, Regras de Negócio, UI/UX/Acessibilidade e Banco de Dados/Performance. Realizada sobre o código real da branch `feature/2026-07-21_ajustes_claude`, cruzando leitura de `actions.ts`, `dashboard.ts`, `reports.ts`, `csv-actions.ts`, `credit-card-actions.ts`, `validations.ts`, `auth.ts`, `proxy.ts`, `schema.prisma` e `CONTEXT.md`.

---

## Resumo Executivo

**Nota geral: 7/10.**

**Virtudes:**
- Lógica de negócio financeira sólida: parcelamento com `decimal.js` (arredondamento correto, sem drift de centavos), separação clara entre fatura de cartão (`is_invoice_header`) e itens, sem duplicidade nos gráficos.
- Padrão consistente de Server Actions (sessão → Zod `.parse()` → Prisma → `revalidatePath`) replicado uniformemente em quase todos os arquivos.
- UX já madura em boa parte dos formulários principais: loading states, toasts, disable de botão durante submit no fluxo de transações.
- Agrupamento inteligente de categorias e sugestão de categoria por histórico (`MappingSuggestion`) são diferenciais bem implementados.

**Fragilidades sistêmicas (no início da auditoria):** fronteira client→server sem tipos estáticos (`any` generalizado), ausência total de índices no schema, uma tela inteira (`/dashboard/settings`) sem revalidação funcional, e um recurso de segurança (2FA) parcialmente implementado que pode enganar quem ler o código superficialmente.

---

## Status Geral

**12 de 16 itens concluídos.**

## 🔴 Prioridade Alta (Crítico / Bugs / Gargalos)

1. ✅ **CONCLUÍDO** — **`/dashboard/settings` não atualizava após mutação.** `settings-forms.tsx` não chamava `router.refresh()` nem existia `revalidatePath("/dashboard/settings")` em nenhuma Server Action. *(actions.ts: createCategory/updateCategory/deleteCategory/createPaymentMethod/... — todas)* → `revalidatePath("/dashboard/settings")` adicionado nas 9 Server Actions.

2. ✅ **CONCLUÍDO** — **Nenhum índice no `Transaction`.** Toda query de dashboard/relatório filtra por `userId` + `data_vencimento` (`dashboard.ts:19,24`; `reports.ts:11-17`). → `@@index([userId, data_vencimento])` adicionado ao `schema.prisma` e aplicado via `prisma db push`.

3. ⬜ **PENDENTE** — **2FA é uma casca vazia e potencialmente insegura.** `authorize()` em `auth.ts` aceita **qualquer** valor não vazio em `credentials.code` quando `status_2fa` é true — não valida contra `secret_2fa`. Não há UI para ativar `status_2fa`. `proxy.ts` referencia `token.isTwoFactorVerified`/`needsTwoFactor`, que o callback `jwt()` nunca seta, e a rota `/auth/verify-2fa` não existe. **Requer decisão:** completar o fluxo ou remover explicitamente o código morto.

4. ✅ **CONCLUÍDO** — **Sem paginação em Relatórios.** `getReportData` (`reports.ts`) carregava todas as transações do período de uma vez, e `report-content.tsx` renderizava o array inteiro via `.flatMap()`. → Paginação client-side implementada em `report-content.tsx` (50 itens/página, com reset de página ao trocar filtro feito durante o render, evitando o anti-padrão de `setState` síncrono em `useEffect`).

5. ✅ **CONCLUÍDO** — **Falha silenciosa na criação inline de categoria/meio de pagamento** durante import CSV/fatura (`csv-import-dialog.tsx`, `credit-card-invoice-dialog.tsx`) — só logava no console. → `toast.error()` adicionado nos 4 pontos.

## 🟡 Prioridade Média (Refatoração / Boas Práticas)

6. ✅ **CONCLUÍDO** — **Tipagem `any` sistemática na fronteira client→server.** Todas as Server Actions recebiam `data: any` em vez do tipo inferido do schema Zod; `dashboard.ts`/`reports.ts` também "achatavam" resultados do Prisma para `any`. → 123 erros `no-explicit-any` eliminados em 21 arquivos (`z.input`/`z.infer` em `validations.ts`, tipos de modelo em `src/types/models.ts`, helper `getErrorMessage` em `src/lib/utils.ts`). `tsc --noEmit`, `npm run lint` e `npm run build` limpos.

7. ⬜ **PENDENTE** — **Tratamento de erro Prisma incompleto e assimétrico.** Só `updateCategory`/`updatePaymentMethod`/`updateFinancialInstitution` tratam `P2002`; os `create*` equivalentes não tratam. Nenhuma action trata `P2025` (not found) ou `P2003` (FK).

8. ✅ **CONCLUÍDO** — **`importCreditCardInvoice` inseria itens um a um** (`Promise.all(items.map(create))` — N `INSERT`s separados). → trocado por `db.creditCardInvoiceItem.createMany({ data: [...] })`.

9. ✅ **CONCLUÍDO** — **Cores hardcoded sem variante `dark:`** em `csv-import-dialog.tsx`, `credit-card-invoice-dialog.tsx`, `financial-health.tsx`, `report-content.tsx`. → variantes `dark:` adicionadas nos banners de erro (vermelho) e nos valores monetários (emerald/rose) dos 4 arquivos.

10. ✅ **CONCLUÍDO** — **Tabelas sem `overflow-x-auto`** em `report-content.tsx`, `csv-import-dialog.tsx`, `credit-card-invoice-dialog.tsx` — risco de estouro horizontal em mobile. → `overflow-hidden` trocado/complementado por `overflow-x-auto` nos 3 wrappers de tabela.

11. ✅ **CONCLUÍDO** — **Código morto removido:** `src/lib/prisma.ts` (singleton alternativo nunca importado — o real é `src/lib/db.ts`), `src/app/dashboard/page.tsx` (mock com `MOCK_DATA`, rota `/dashboard` não linkada em lugar algum), `mail.ts`/`mail.js` (nenhum importado). Dependências órfãs (`nodemailer`, `@types/nodemailer`) removidas junto — só existiam para `mail.js`.

## 🟢 Prioridade Baixa (Polimento)

12. ✅ **CONCLUÍDO** — **Inconsistência de loading state** entre `credit-card-invoice-dialog.tsx` (usa `Loader2`) e `csv-import-dialog.tsx` (só texto "Processando..."). → `csv-import-dialog.tsx` agora usa o mesmo padrão `Loader2` + texto.

13. ⬜ **PENDENTE** — **`export-buttons.tsx`** é 100% mock (`alert()`), sem exportação real de CSV/PDF.

14. ⬜ **PENDENTE** — **`data_pagamento` nunca é preenchido** por `payTransaction()` — campo existe no schema mas fica sempre `null`.

15. ✅ **CONCLUÍDO** — **`@auth/prisma-adapter`** era dependência instalada e não usada (sessão é 100% JWT). → removida via `npm uninstall`.

16. ✅ **CONCLUÍDO** (efeito colateral do item 6) — **Mensagens de erro genéricas descartavam a causa original** em `getMappingSuggestions`/`getInvoiceItems`. → ambos usam `getErrorMessage(error, fallback)`, preservando a mensagem original quando disponível.

---

## Próximos Candidatos (por esforço)

- **Baixo esforço, mecânico, sem decisão pendente:** item 13 (`export-buttons.tsx` — exportação real de CSV/PDF), item 14 (preencher `data_pagamento` em `payTransaction()`).
- **Esforço médio:** item 7 (padronizar tratamento de `P2002`/`P2025`/`P2003` em todas as Server Actions).
- **Decidido, aguardando o usuário:** item 3 (2FA — usuário optou por deixar como está por enquanto; casca vazia continua documentada como risco conhecido).

## Verificação

- Itens 1, 5, 8: testar manualmente no navegador (`npm run dev`) — editar/excluir em `/dashboard/settings` e confirmar atualização sem F5; forçar erro na criação inline de categoria durante import CSV e confirmar toast; importar uma fatura com múltiplos itens e conferir no log do Postgres (ou Prisma query log) que vira uma única query `INSERT`.
- Item 2: `npx prisma db push` aplica o índice; confirmar via `\d "Transaction"` no `psql`.
- Após qualquer mudança: `npm run lint` e `npx tsc --noEmit` para garantir que nada quebrou a tipagem existente.
