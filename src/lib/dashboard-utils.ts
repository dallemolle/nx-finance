export const getCategoryGroupName = (name: string) => {
    const n = name.toLowerCase().trim();
    if (n.startsWith("mercado") || n.startsWith("mer")) return "Mercado";
    if (n.startsWith("comida") || n.startsWith("restaurante") || n.startsWith("ifood")) return "Alimentação";
    return n.charAt(0).toUpperCase() + n.slice(1);
};

// Assinatura curta de estabelecimento usada para aprender/casar sugestões de
// categoria entre importações. Extratos reais variam número de referência,
// cidade, data etc. a cada lançamento do mesmo estabelecimento — as 2
// primeiras palavras (normalmente marca + tipo) tendem a ser estáveis,
// enquanto esse ruído fica nas palavras seguintes.
export const getMerchantSignature = (text: string): string => {
    const normalized = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return normalized.split(" ").filter(Boolean).slice(0, 2).join(" ");
};
