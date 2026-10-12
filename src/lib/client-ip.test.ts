import { describe, expect, test } from "vitest";
import { clientIpFromHeaders } from "./client-ip";

// BL-036: IP do cliente pro limite de tentativas de login.
describe("clientIpFromHeaders", () => {
    test("x-real-ip (preenchido pela Vercel) tem preferência", () => {
        expect(clientIpFromHeaders({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" })).toBe("203.0.113.7");
    });

    test("sem x-real-ip, usa o primeiro endereço do x-forwarded-for", () => {
        expect(clientIpFromHeaders({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" })).toBe("198.51.100.1");
    });

    test("aceita cabeçalho repetido (array)", () => {
        expect(clientIpFromHeaders({ "x-forwarded-for": ["198.51.100.1", "10.0.0.1"] })).toBe("198.51.100.1");
    });

    test("sem cabeçalho (dev local), não há IP", () => {
        expect(clientIpFromHeaders({})).toBeNull();
        expect(clientIpFromHeaders(undefined)).toBeNull();
        expect(clientIpFromHeaders({ "x-forwarded-for": "  " })).toBeNull();
    });

    test("valor absurdo é cortado (não vira chave gigante no banco)", () => {
        expect(clientIpFromHeaders({ "x-real-ip": "a".repeat(500) })?.length).toBe(64);
    });
});
