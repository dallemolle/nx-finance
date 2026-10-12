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

1. **Importação de fatura:** BL-001, BL-002, BL-003, BL-005, BL-004, BL-006 e a parte de BL-012 que toca nesse diálogo. Em seguida, BL-023. ✅ Concluída.
1.1. **Correção urgente (bug em produção):** BL-026, BL-027, BL-028 e BL-029, no branch `feature/2026-10-09_corrige_conciliacao_parcelas`. ✅ Concluída.
2. **Datas:** BL-025. Entrou antes da etapa de dashboard porque afeta o que todas as telas mostram. ✅ Concluída.
3. **Dashboard e faturas:** BL-007, BL-009, BL-011, BL-008, BL-010 e o restante de BL-012, no branch `feature/2026-10-12_dashboard_e_faturas`. ✅ Concluída.
4. **Código:** BL-033 primeiro (prazo: 19/10/2026), com BL-034 e BL-035, que mexem no mesmo CI; depois BL-013 junto com BL-014, BL-015 e BL-016, no branch `feature/2026-10-12_etapa_codigo`. ✅ Concluída. BL-014 continua como prática: cobrir com teste cada arquivo que for mexido.
5. **Segurança da conta:** BL-021, depois BL-022.
6. **Depois, só com motivo concreto:** BL-017 e BL-018.
7. **Com o usuário:** BL-020 e BL-032 (em validação até novembro de 2026). (BL-019 ✅ concluído.)
8. **Funcionalidades novas, sem pressa:** BL-030 e BL-031.

## Pendentes

### Técnico

- [ ] **BL-017: vulnerabilidades que exigem versão principal nova.** **Baixa.**
  O `npm audit` aponta 13 vulnerabilidades, todas em ferramentas de desenvolvimento e build: Tailwind 3 (resolvida no 4), a CLI do Prisma (via `effect`, resolvida no 8) e o `eslint-config-next`. Cada uma é uma migração; tratar como projeto próprio.
- [ ] **BL-018: deploy da Vercel sem sincronia com o banco.** **Baixa.**
  A Vercel publica o código sem esperar o CI, então o código novo pode entrar no ar antes do `db push`. Enquanto isso não muda, mudanças que removem algo do schema devem ir em dois deploys. Se o schema passar a mudar com frequência, avaliar a migração para `prisma migrate` (histórico e `migrate deploy`).

### Segurança da conta (vindo do AUDIT.md)

- [ ] **BL-021: códigos de recuperação do 2FA.** **Média.**
  Hoje, quem perde o celular com o app autenticador perde o acesso à conta. Gerar códigos de uso único na ativação do 2FA, guardados com hash, e aceitá-los no lugar do código TOTP.
- [ ] **BL-022: pedir a senha para desativar o 2FA.** **Baixa.**
  Hoje basta o código TOTP atual. Exigir também a senha, como confirmação extra. Arquivo: `src/lib/two-factor-actions.ts`.

### Funcionalidades novas

Ideias que vieram do branch abandonado `feature/2026-07-18_prev-desc-new_table` (último commit `7d64086`, apagado em 2026-10-10). O código dele não serve mais: é anterior ao schema atual e à refatoração em `src/lib/services/`. Se for implementar, fazer do zero, seguindo o padrão atual e com testes.

- [ ] **BL-030: despesa prevista recorrente.** **Baixa.**
  Hoje a despesa prevista só divide um valor em parcelas. Permitir repetir o mesmo valor por N meses (aluguel, escola, assinatura), criando um lançamento previsto por mês, que depois é confirmado como já acontece com `confirmEstimatedExpenseForUser`.
- [ ] **BL-031: conciliar previstas na importação do extrato.** **Baixa.**
  Ao importar o CSV do banco, sugerir qual lançamento previsto cada linha quita (valor parecido, data próxima, descrição semelhante) e confirmar os pares em lote, em vez de confirmar cada prevista à mão.

### Ações do usuário

- [ ] **BL-032: validar em produção a correção das parcelas (BL-026 a BL-029).** **Média.** 👤 **Ação do usuário.** ⏳ **Em validação, retomar em novembro de 2026.**
  Em 2026-10-10 a fatura errada foi apagada, as previstas do Nubank excluídas e o CSV de setembro reimportado. A primeira conferência parece correta. A confirmação definitiva fica para a importação da fatura de outubro (vencimento em novembro). Conferir:
  - o total da fatura bate com o boleto, e cada parcela aparece uma vez só (sem "Parcela 3/5" e "(03/05)" juntas);
  - a fatura prevista de novembro foi substituída pela importada, sem sumir nem duplicar;
  - as parcelas dos meses seguintes continuam em `/faturas` → Nubank → Ver meses.
  Se aparecer algo errado, abrir um item novo com o caso real.
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
| BL-C14 | Branches abandonados de julho apagados (local e GitHub): `2026-07-15_lancto_previsao_despesa` (`9a83336`), `2026-07-17_prev_desp` (`3185732`) e `2026-07-18_prev-desc-new_table` (`7d64086`); ideias aproveitáveis viraram BL-030 e BL-031 | 2026-10-10 |
| BL-C15 | CI usa o Postgres que já vem instalado no runner em vez de imagem de container (Docker Hub e ECR Public deram `toomanyrequests` em downloads anônimos) | 2026-10-11 · `5bf98a3` |
| BL-001 | Importação: escolher o cartão (agora o primeiro campo) preenche instituição, vencimento, meio de pagamento e descrição | 2026-10-09 · `2343bdd` |
| BL-002 | Importação: mostra o que falta para avançar ou importar; itens sem categoria destacados, "aplicar a todos sem categoria" e propagação da categoria para o mesmo estabelecimento | 2026-10-09 · `2343bdd` |
| BL-003 | Importação: botão Voltar na revisão, preservando o que já foi editado | 2026-10-09 · `2343bdd` |
| BL-004 | Importação: arrastar e soltar o CSV | 2026-10-09 · `2343bdd` |
| BL-005 | Importação: valores em formato de moeda e estornos destacados | 2026-10-09 · `2343bdd` |
| BL-006 | Importação: atalho de 1 clique também para parcela N/M com N > 1 (exceto a última) | 2026-10-09 · `2343bdd` |
| BL-013 | Uma só divisão em parcelas: `createTransaction`, despesa prevista genérica e as prévias dos três formulários passam a usar `splitInstallments` (prévia e gravação saem da mesma conta) | 2026-10-12 · `a2f4e02` |
| BL-014 | Testes de integração de `createTransaction`/`updateTransaction`, `payTransaction`, `getDashboardData`/`getMonthlyTrend` e despesa prevista genérica. Faltam `csv-actions.ts` e `reports.ts`: cobrir quando forem mexidos | 2026-10-12 · `a2f4e02` |
| BL-015 | Um só `getSessionUserId` (4 cópias de `getUserId` e a sessão lida à mão em `searchTransactions`); `two-factor-actions` mantém o próprio por precisar do e-mail | 2026-10-12 · `a2f4e02` |
| BL-016 | Lint de 9 avisos para 0, e `npm run lint` passa a falhar com qualquer aviso (`--max-warnings 0`) | 2026-10-12 · `a2f4e02` |
| BL-033 | CI com runner fixo em `ubuntu-24.04` (o `ubuntu-latest` vira Ubuntu 26 em 19/10/2026 e o CI depende do Postgres da imagem) | 2026-10-12 · `21d38b2` |
| BL-034 | Node 24 em `.nvmrc`, lido pelo CI (`node-version-file`) e citado no README. A Vercel (produção) também está no 24.x, conferido em 2026-10-12: desenvolvimento, CI e produção na mesma versão | 2026-10-12 · `21d38b2` |
| BL-035 | `actions/checkout`, `setup-node` e `upload-artifact` na v7 (Node 24; a v4 rodava no Node 20, descontinuado) | 2026-10-12 · `21d38b2` |
| BL-019 | 👤 Ruleset "Proteger staging e main" ativo: exige PR e os checks "Lint, tipos e testes" e "Testes de ponta a ponta", os dois aceitos só do GitHub Actions; bloqueia push forçado e exclusão | 2026-10-10 |
| BL-007 | Variação "vs mês anterior": cor pelo sentido do que se mede (saída subindo é vermelho), formato pt-BR ("+12,3%") e saldo saindo do negativo como melhora (dividia pelo valor com sinal: -100 → +50 aparecia -150%) | 2026-10-12 · `d4ed11b` |
| BL-008 | Gráficos: eixo Y compacto, grade discreta, total no topo das colunas de fatura, valor do mês atual no saldo, linha do zero, legenda só das séries com dados, tooltip em português e no tema escuro, mensagem quando não há fatura; modo privacidade esconde valores. Cores validadas | 2026-10-12 · `e0a2983` |
| BL-009 | Etiqueta da fatura prevista já mostrava "Previsto" (não reproduz). Achado no lugar: previsões tinham o botão "Liquidar", que deixava o lançamento pago e ainda previsto, fora dos totais — botão removido e `payTransaction` recusa previsto | 2026-10-12 · `d4ed11b` |
| BL-010 | Não reproduz: com a página compilada, 1ª barra em ~0,3 s e animação completa em ~0,7 s; os 2–3 s eram a compilação do `next dev` na primeira visita | 2026-10-12 · `e0a2983` |
| BL-011 | "Imposto De Renda Da" vinha do CSS `capitalize`; `titleCasePtBr()` mantém preposições/artigos em minúscula e siglas como estão (só exibição) | 2026-10-12 · `d4ed11b` |
| BL-012 | Acessibilidade dos diálogos: descrição em todos, rótulos ligados aos campos, nomes nas linhas da revisão do CSV e no botão de editar; teste e2e de regressão | 2026-10-09 · `2343bdd` (importação de fatura) · 2026-10-12 · `09b28ac` (demais) |
| BL-023 | Teste de ponta a ponta da importação (`npm run test:e2e`, Playwright, banco `<nome>_e2e`): CSV, cartão, revisão, parcela, categorias, importação e `/faturas`; roda no CI antes do `db push` | 2026-10-09 · `04ca85c` |
| BL-024 | Leitura do CSV: `02/10/2026` era lido como 10 de fevereiro e `R$ 1.234,56` como 1,234; datas com barra agora são dia/mês e o separador de milhar é tratado | 2026-10-09 · `2343bdd` |
| BL-025 | 🐞 Datas sem hora no dia certo no fuso de Brasília: convenção "meia-noite UTC do dia" em `src/lib/date-only.ts`, aplicada nos schemas, telas (antes um dia antes), intervalos de mês do servidor (lançamento do dia 1º caía no mês anterior no dev) e notificações (conta que vence hoje aparecia atrasada). Dados existentes já seguem a convenção, sem correção no banco. Testes rodam em Brasília; e2e com servidor em UTC | 2026-10-12 · `94a3b80` |
| BL-026 | 🐞 Importar a fatura real substitui a fatura prevista do mesmo cartão e ciclo (apagada inteira) em vez de mover as parcelas previstas para ela, o que duplicava a parcela do mês | 2026-10-09 · `efebf70` |
| BL-027 | 🐞 Vencimento sugerido na importação fica no mês corrente, mesmo já vencido (antes pulava para o mês seguinte e a importação caía na fatura errada) | 2026-10-09 · `e168d6a` |
| BL-028 | Excluir lançamentos previstos em lote em `/faturas` (por item, por mês ou todos do cartão) | 2026-10-09 · `faf4bad` |
| BL-029 | Excluir uma fatura importada (e os itens dela) pela lixeira em "Lançamentos do Mês", para refazer uma importação errada; não afeta as previstas | 2026-10-09 · `7094a43` |
