import { describe, expect, test } from "vitest";
import { detectInstallmentInDescription } from "./dashboard-utils";

describe("detectInstallmentInDescription", () => {
    test.each([
        ["Pb*Coffee Mais - Parcela 1/3", 1, 3],
        ["Petlove - NuPay - Parcela 1/2", 1, 2],
        ["Localiza Jpj Veiculos - Parcela 3/3", 3, 3],
        ["Amazon BR V - NuPay - Parcela 3/10", 3, 10],
        ["Pg *Filipe Deschamps T - Parcela 8/12", 8, 12],
    ])("extrato real: %s -> %i/%i", (descricao, number, total) => {
        expect(detectInstallmentInDescription(descricao)).toEqual({ number, total });
    });

    test.each([
        ["Compra Loja X 1/5", 1, 5],
        ["Compra Loja Y 1-5", 1, 5],
        ["Compra Loja Z 1 de 5", 1, 5],
        ["Compra Loja W 01 de 12", 1, 12],
    ])("padrão solto sem a palavra Parcela: %s -> %i/%i", (descricao, number, total) => {
        expect(detectInstallmentInDescription(descricao)).toEqual({ number, total });
    });

    test.each([
        ["Panificadora Massabor", "sem números"],
        ["Compra 01/2026", "data não é confundida com parcela"],
        ["Estorno 5/3", "parcela maior que o total"],
        ["Uber Trip", "sem separador numérico"],
    ])("não detecta parcela em %s (%s)", (descricao) => {
        expect(detectInstallmentInDescription(descricao)).toBeNull();
    });
});
