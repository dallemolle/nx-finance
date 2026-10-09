# Backlog

Melhorias levantadas na revisão de usabilidade, testes e segurança de 2026-10-09.

## Como usar

- Cada item tem um ID (`BL-NNN`) que não muda, mesmo que o item mude de posição.
- Status: `[ ]` pendente · `[x]` concluído. Itens que dependem de algo além de código estão marcados com 🟡 **Aguardando decisão** ou 👤 **Ação do usuário**.
- Cada implementação vai num branch próprio, com o padrão `feature/yyyy-mm-dd_alteracao_a_ser_implementada` (ex.: `feature/2026-10-09_backlog_melhorias`).
- Ao concluir um item: troque `[ ]` por `[x]`, preencha **Concluído em** com a data e o commit, e mova o item para a seção [Concluídos](#concluídos).
- Prioridade: **Alta** (afeta o uso diário ou a segurança), **Média** (incomoda, mas tem contorno) ou **Baixa** (limpeza, ou só vale a pena com outra mudança).

## Pendentes

### Importação de fatura

O fluxo mais usado no dia a dia. Arquivo principal: `src/components/dashboard/credit-card-invoice-dialog.tsx`.

- [ ] **BL-001: o cartão preenche os outros campos.** **Alta.**
  Ao escolher o cartão, preencher a instituição (`card.institution_id`), o vencimento (a partir de `card.dueDay`), o meio de pagamento ("Cartão de crédito") e a descrição (ex.: "Fatura Nubank Out/2026"). O cartão passa a ser o primeiro campo. Hoje são 5 campos para preencher; ficariam 2 (arquivo e cartão).
- [ ] **BL-002: dizer por que "Importar" está desabilitado.** **Alta.**
  O botão exige categoria em todas as linhas e não avisa. Mostrar "faltam N categorias", destacar as linhas pendentes e permitir aplicar uma categoria a várias linhas selecionadas.
- [ ] **BL-003: botão "Voltar" na revisão.** **Alta.**
  Hoje só existe "Cancelar", que perde tudo o que foi preenchido.
- [ ] **BL-004: arrastar e soltar o arquivo.** **Média.**
  A área tracejada sugere que dá para arrastar o CSV, mas não existe `onDrop`.
- [ ] **BL-005: valores em formato de moeda e estornos destacados.** **Média.**
  A revisão mostra `245,9` em vez de `R$ 245,90`, e os valores negativos (estornos) não têm destaque visual.
- [ ] **BL-006: detectar parcela N/M quando N > 1.** **Média.** 🟡 **Aguardando decisão.**
  A detecção automática só oferece o atalho para "parcela 1/N" (ver o comentário em `credit-card-invoice-dialog.tsx`). Se o primeiro import de um cartão vier com "Parcela 3/6", as parcelas 4 a 6 nunca são projetadas. Decidir se isso é intencional ou se deve passar a detectar qualquer N.

### Dashboard e faturas

- [ ] **BL-007: cor e formato da variação percentual.** **Média.**
  Em "Saídas", um aumento de gasto aparece em verde. O número usa ponto (`0.0%`) em vez de vírgula. Arquivo: `src/components/dashboard/summary-cards.tsx`.
- [ ] **BL-008: valores e eixos nos gráficos.** **Média.**
  A tendência de 6 meses e as barras de fatura (dashboard e `/faturas`) não mostram valores nem eixo. A legenda "Confirmado" aparece mesmo quando não há nenhuma barra confirmada.
- [ ] **BL-009: etiqueta vazia na "Fatura Prevista".** **Baixa.**
  Na lista de lançamentos do dashboard, a linha de fatura prevista mostra uma etiqueta de status sem texto.
- [ ] **BL-010: gráficos de `/faturas` demoram a aparecer.** **Média.**
  Levam de 2 a 3 segundos para mostrar as barras, e até lá o card fica vazio. Investigar se a causa é a busca dos dados ou a animação, e mostrar um placeholder enquanto carrega.
- [ ] **BL-011: preposições em maiúscula nas descrições.** **Baixa.**
  Aparece "Imposto **De** Renda **Da** Pessoa Física". Descobrir onde a descrição vira Title Case e manter preposições (de, da, do, das, dos, e) em minúscula.
- [ ] **BL-012: acessibilidade dos formulários e diálogos.** **Média.**
  Na importação, os campos de data e os seletores não têm rótulo associado (`htmlFor`/`id`). Os diálogos não têm `Description`, o que gera aviso no console.

### Técnico

- [ ] **BL-013: unificar o cálculo de parcelas de despesa genérica.** **Média.**
  `createTransaction` (`src/lib/actions.ts`) tem uma cópia própria da divisão em parcelas em vez de usar `splitInstallments`. Unificar e cobrir com teste.
- [ ] **BL-014: testes para o que ainda não tem cobertura.** **Média.**
  `actions.ts`, `csv-actions.ts`, `reports.ts` e `getDashboardData` não têm testes. Seguir o padrão de `src/lib/services/` e cobrir aos poucos, a cada mudança nesses arquivos.
- [ ] **BL-015: um único `getUserId`.** **Baixa.**
  Ainda há cópias de `getUserId` em `actions.ts`, `csv-actions.ts`, `credit-card-actions.ts` e `credit-card-provision-actions.ts`. Substituir todas por `getSessionUserId` de `src/lib/session.ts`.
- [ ] **BL-016: avisos antigos de lint.** **Baixa.**
  `npm run lint` mostra 15 avisos, quase todos variáveis e imports sem uso.
- [ ] **BL-017: vulnerabilidades que exigem versão principal nova.** **Baixa.**
  O `npm audit` aponta 13 vulnerabilidades, todas em ferramentas de desenvolvimento e build: Tailwind 3 (resolvida no 4), a CLI do Prisma (via `effect`, resolvida no 8) e o `eslint-config-next`. Cada uma é uma migração; tratar como projeto próprio.
- [ ] **BL-018: deploy da Vercel sem sincronia com o banco.** **Baixa.**
  A Vercel publica o código sem esperar o CI, então o código novo pode entrar no ar antes do `db push`. Enquanto isso não muda, mudanças que removem algo do schema devem ir em dois deploys. Se o schema passar a mudar com frequência, avaliar a migração para `prisma migrate` (histórico e `migrate deploy`).

### Ações do usuário

- [ ] **BL-019: proteção de branch no GitHub.** **Alta.** 👤 **Ação do usuário.**
  Criar o ruleset para `staging` e `main` exigindo PR e a verificação "Lint, tipos e testes", com 0 aprovações.
- [ ] **BL-020: senha do usuário dev local.** **Baixa.** 👤 **Ação do usuário.**
  A senha local foi redefinida para `NxDev@2026` durante a revisão. Trocar se quiser. Afeta só o banco local.

## Concluídos

| ID | Item | Concluído em |
|---|---|---|
| BL-C01 | Layout sem rolagem horizontal no celular e em telas médias; `/faturas` usando a largura toda; legenda de categorias truncando nomes longos; `.playwright-mcp/` no `.gitignore` | 2026-10-09 · `e370174` |
| BL-C02 | Vitest configurado (`npm test`) | 2026-10-09 · `916dbd4` |
| BL-C03 | A projeção do mês não infla mais com despesas agendadas | 2026-10-09 · `916dbd4` |
| BL-C04 | "Saúde Financeira" e "Comprometimento" mostram "Sem receita" em vez de "Crítico, 100%" quando não há receita | 2026-10-09 · `916dbd4` |
| BL-C05 | Scripts de verificação sem banco migrados para o Vitest, com o caso de borda do dia de fechamento | 2026-10-09 · `8343777` |
| BL-C06 | Testes de integração em banco separado (`<nome>_test`); provisionamento movido para `src/lib/services/` | 2026-10-09 · `45db14e` |
| BL-C07 | Importação de fatura e aviso de duplicidade cobertos por testes de integração | 2026-10-09 · `db8a81f` |
| BL-C08 | Notificações testáveis; pasta `scripts/` eliminada | 2026-10-09 · `a37e54e` |
| BL-C09 | Segurança: as 11 Server Actions pegam o `userId` da sessão; teste de proteção contra regressão | 2026-10-09 · `e556ae0` |
| BL-C10 | `npm audit fix` sem `--force`: 0 vulnerabilidades críticas (`next` 16.4, `next-auth` 4.24.15) | 2026-10-09 · `67de88d` |
| BL-C11 | Lint sem erros (de 8 para 0) | 2026-10-09 · `9d0d56b` |
| BL-C12 | `AGENTS.md` (gerado pelo `next dev`) versionado | 2026-10-09 · `dd60ace` |
| BL-C13 | CI (lint, tipos e testes) antes do `db push`; diff de schema nos PRs | 2026-10-09 · `ce27820` |
