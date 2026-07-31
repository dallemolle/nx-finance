// Script de verificação (sem banco): valida detectInstallmentInDescription
// (src/lib/dashboard-utils.ts) contra exemplos reais de extrato (Nubank) e
// os padrões soltos pedidos explicitamente (N/M, N-M, N de M). A função só
// extrai número/total — nunca altera a descrição do lançamento.
import { detectInstallmentInDescription } from "../src/lib/dashboard-utils";

function assertEqual(actual: unknown, expected: unknown, msg: string) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`FALHOU: ${msg}\n  esperado: ${e}\n  obtido:   ${a}`);
    }
    console.log(`OK: ${msg}`);
}

// --- Padrão "Parcela N/M" (extrato real de cartão) ---
assertEqual(
    detectInstallmentInDescription("Pb*Coffee Mais - Parcela 1/3"),
    { number: 1, total: 3 },
    'extrato real: "Pb*Coffee Mais - Parcela 1/3" -> 1/3'
);
assertEqual(
    detectInstallmentInDescription("Petlove - NuPay - Parcela 1/2"),
    { number: 1, total: 2 },
    'extrato real: "Petlove - NuPay - Parcela 1/2" -> 1/2'
);
assertEqual(
    detectInstallmentInDescription("Localiza Jpj Veiculos - Parcela 3/3"),
    { number: 3, total: 3 },
    'última parcela "3/3" também é reconhecida'
);
assertEqual(
    detectInstallmentInDescription("Amazon BR V - NuPay - Parcela 3/10"),
    { number: 3, total: 10 },
    "parcela com total de 2 dígitos (3/10)"
);
assertEqual(
    detectInstallmentInDescription("Pg *Filipe Deschamps T - Parcela 8/12"),
    { number: 8, total: 12 },
    "parcela 8/12"
);

// --- Padrões soltos (sem a palavra "Parcela"), pedidos explicitamente ---
assertEqual(
    detectInstallmentInDescription("Compra Loja X 1/5"),
    { number: 1, total: 5 },
    'padrão solto "1/5" (sem palavra-chave)'
);
assertEqual(
    detectInstallmentInDescription("Compra Loja Y 1-5"),
    { number: 1, total: 5 },
    'padrão solto "1-5"'
);
assertEqual(
    detectInstallmentInDescription("Compra Loja Z 1 de 5"),
    { number: 1, total: 5 },
    'padrão solto "1 de 5"'
);
assertEqual(
    detectInstallmentInDescription("Compra Loja W 01 de 12"),
    { number: 1, total: 12 },
    'padrão solto com zero à esquerda "01 de 12"'
);

// --- Não deve alterar a descrição original (a função não recebe/retorna texto) ---
const original = "Pb*Coffee Mais - Parcela 1/3";
detectInstallmentInDescription(original);
assertEqual(original, "Pb*Coffee Mais - Parcela 1/3", "chamar a função não muta a string original (imutabilidade básica de string, guard de regressão)");

// --- Casos negativos: não deve detectar nada (e não deve quebrar) ---
assertEqual(detectInstallmentInDescription("Panificadora Massabor"), null, "descrição sem números -> null");
assertEqual(detectInstallmentInDescription("Compra 01/2026"), null, "data (01/2026) não é confundida com parcela (total > 48)");
assertEqual(detectInstallmentInDescription("Estorno 5/3"), null, "parcela maior que o total (5/3) é rejeitada");
assertEqual(detectInstallmentInDescription("Uber Trip"), null, "sem nenhum separador numérico -> null");

console.log("\nTodos os testes de detecção de parcela na descrição passaram.");
