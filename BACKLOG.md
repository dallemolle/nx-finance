# Backlog

Melhorias levantadas na revisão de usabilidade, testes e segurança de 2026-10-09. Os pontos ainda abertos da auditoria anterior ([AUDIT.md](AUDIT.md), cujos 16 itens já estão concluídos) também foram trazidos para cá.

## Como usar

- Cada item tem um ID (`BL-NNN`) que não muda, mesmo que o item mude de posição.
- Status: `[ ]` pendente · `[x]` concluído. Itens que dependem de algo além de código estão marcados com 🟡 **Aguardando decisão** ou 👤 **Ação do usuário**.
- Cada implementação vai num branch próprio, com o padrão `feature/yyyy-mm-dd_alteracao_a_ser_implementada` (ex.: `feature/2026-10-09_backlog_melhorias`).
- Ao concluir um item: troque `[ ]` por `[x]`, preencha **Concluído em** com a data e o commit, e mova o item para a seção [Concluídos](#concluídos).
- Prioridade: **Alta** (afeta o uso diário ou a segurança), **Média** (incomoda, mas tem contorno) ou **Baixa** (limpeza, ou só vale a pena com outra mudança).

## Ordem de execução

Combinada em 2026-10-09. Cada etapa vai no seu próprio branch `feature/...`.

1. **Importação de fatura:** BL-001, BL-002, BL-003, BL-005, BL-004, BL-006 e a parte de BL-012 que toca nesse diálogo. Em seguida, BL-023.
2. **Dashboard e faturas:** BL-007, BL-009, BL-011, BL-008, BL-010 e o restante de BL-012.
3. **Código:** BL-013 junto com BL-014, depois BL-015 e BL-016.
4. **Segurança da conta:** BL-021, depois BL-022.
5. **Depois, só com motivo concreto:** BL-017 e BL-018.
6. **Com o usuário:** BL-019 (de preferência antes do primeiro PR) e BL-020.

## Pendentes

### Importação de fatura

O fluxo mais usado no dia a dia. Arquivo principal: `src/components/dashboard/credit-card-invoice-dialog.tsx`. Os itens BL-001 a BL-006 e o BL-024 foram concluídos (ver [Concluídos](#concluídos)).

- [ ] **BL-023: teste de ponta a ponta da importação de fatura.** **Média.**
  Teste com Playwright (`@playwright/test`) que passa pela tela: sobe um CSV, escolhe o cartão, ativa uma parcela, categoriza e importa, conferindo o resultado no dashboard e em `/faturas`. Protege o fluxo mais usado contra regressões de tela, que os testes de integração não pegam. Agora que BL-001 a BL-006 estão prontos, é o próximo item da etapa 1.

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
  Os diálogos não têm `Description`, o que gera aviso no console, e há campos sem rótulo associado (`htmlFor`/`id`).
  **Parcial (2026-10-09, `2343bdd`):** a importação de fatura já foi corrigida (rótulos ligados, `aria-label` nas linhas da revisão, `DialogDescription`). Os componentes `Combobox` e `InstitutionCombobox` agora aceitam `id`. Falta aplicar o mesmo nos outros diálogos: nova transação, editar transação, importar CSV, compra parcelada e despesa prevista.

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

### Segurança da conta (vindo do AUDIT.md)

- [ ] **BL-021: códigos de recuperação do 2FA.** **Média.**
  Hoje, quem perde o celular com o app autenticador perde o acesso à conta. Gerar códigos de uso único na ativação do 2FA, guardados com hash, e aceitá-los no lugar do código TOTP.
- [ ] **BL-022: pedir a senha para desativar o 2FA.** **Baixa.**
  Hoje basta o código TOTP atual. Exigir também a senha, como confirmação extra. Arquivo: `src/lib/two-factor-actions.ts`.

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
| BL-001 | Importação: escolher o cartão (agora o primeiro campo) preenche instituição, vencimento, meio de pagamento e descrição | 2026-10-09 · `2343bdd` |
| BL-002 | Importação: mostra o que falta para avançar ou importar; itens sem categoria destacados, "aplicar a todos sem categoria" e propagação da categoria para o mesmo estabelecimento | 2026-10-09 · `2343bdd` |
| BL-003 | Importação: botão Voltar na revisão, preservando o que já foi editado | 2026-10-09 · `2343bdd` |
| BL-004 | Importação: arrastar e soltar o CSV | 2026-10-09 · `2343bdd` |
| BL-005 | Importação: valores em formato de moeda e estornos destacados | 2026-10-09 · `2343bdd` |
| BL-006 | Importação: atalho de 1 clique também para parcela N/M com N > 1 (exceto a última) | 2026-10-09 · `2343bdd` |
| BL-024 | Leitura do CSV: `02/10/2026` era lido como 10 de fevereiro e `R$ 1.234,56` como 1,234; datas com barra agora são dia/mês e o separador de milhar é tratado | 2026-10-09 · `2343bdd` |
