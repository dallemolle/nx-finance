type Headers = Record<string, string | string[] | undefined> | undefined;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// IP do cliente pra limitar tentativas de login (BL-036). Na Vercel,
// x-real-ip e x-forwarded-for são preenchidos pela plataforma (o valor mandado
// pelo navegador é sobrescrito). Sem cabeçalho (dev local), devolve null e o
// limite fica só por e-mail.
export function clientIpFromHeaders(headers: Headers): string | null {
    const raw = first(headers?.["x-real-ip"]) ?? first(headers?.["x-forwarded-for"])?.split(",")[0];
    const ip = raw?.trim().slice(0, 64);
    return ip ? ip : null;
}
