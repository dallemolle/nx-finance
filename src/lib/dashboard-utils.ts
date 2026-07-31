export const getCategoryGroupName = (name: string) => {
    const n = name.toLowerCase().trim();
    if (n.startsWith("mercado") || n.startsWith("mer")) return "Mercado";
    if (n.startsWith("comida") || n.startsWith("restaurante") || n.startsWith("ifood")) return "Alimentação";
    return n.charAt(0).toUpperCase() + n.slice(1);
};

export interface CategorySlice {
    name: string;
    value: number;
    fill: string;
    sourceNames: string[];
}

const normalizeCategoryText = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Agrupa fatias de categoria quase-duplicadas que getCategoryGroupName não
// generaliza (ex: "Transp" e "Transporte" são registros de Category
// distintos, já que o nome é único só por usuário+tipo — não sinônimos
// semânticos como "comida"/"ifood"). Duas fatias se unem quando o nome
// normalizado de uma é prefixo do da outra (mínimo 3 caracteres). O nome
// canônico exibido é sempre a variante mais completa (mais longa).
export const mergeSimilarCategories = (
    data: { name: string; value: number; fill: string }[]
): CategorySlice[] => {
    const buckets: (CategorySlice & { normalized: string })[] = [];

    for (const item of data) {
        const normalized = normalizeCategoryText(item.name);
        const match = buckets.find(b => {
            if (normalized.length < 3 || b.normalized.length < 3) return false;
            return b.normalized.startsWith(normalized) || normalized.startsWith(b.normalized);
        });
        if (match) {
            match.value += item.value;
            match.sourceNames.push(item.name);
            if (item.name.length > match.name.length) {
                match.name = capitalize(item.name);
                match.normalized = normalized;
                match.fill = item.fill;
            }
        } else {
            buckets.push({ name: capitalize(item.name), value: item.value, fill: item.fill, sourceNames: [item.name], normalized });
        }
    }

    return buckets.map(b => ({ name: b.name, value: b.value, fill: b.fill, sourceNames: b.sourceNames }));
};

export const OTHERS_CATEGORY_COLOR = "#94a3b8";

// Limita a exibição a N categorias principais (por valor) + 1 fatia "Outros"
// agrupando o restante, para manter o gráfico/legenda legíveis.
export const capToTopNPlusOthers = (slices: CategorySlice[], n = 5): CategorySlice[] => {
    const sorted = [...slices].sort((a, b) => b.value - a.value);
    if (sorted.length <= n) return sorted;

    const top = sorted.slice(0, n);
    const rest = sorted.slice(n);
    const others: CategorySlice = {
        name: "Outros",
        value: rest.reduce((sum, s) => sum + s.value, 0),
        fill: OTHERS_CATEGORY_COLOR,
        sourceNames: rest.flatMap(s => s.sourceNames),
    };
    return [...top, others];
};

export interface DetectedInstallment {
    number: number;
    total: number;
}

// Padrões tentados em ordem de confiança: primeiro os que trazem a palavra
// "parcela"/"parc" explícita (baixo risco de falso positivo), depois padrões
// soltos (N/M, N-M, N de M) que extratos de alguns bancos usam sem palavra-chave.
const INSTALLMENT_PATTERNS: RegExp[] = [
    /parc(?:ela)?s?\.?\s*:?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i,
    /\(?\b(\d{1,2})\s*\/\s*(\d{1,2})\)?\b/,
    /\b(\d{1,2})\s*-\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s+de\s+(\d{1,2})\b/i,
];

// Tenta reconhecer uma indicação de parcela embutida na descrição de um
// lançamento (extratos de cartão costumam trazer isso no próprio título,
// ex: "Pb*Coffee Mais - Parcela 1/3"). Só o número/total são extraídos — a
// descrição do lançamento nunca é alterada por essa função. Chamada apenas
// quando o usuário ativa o parcelamento manualmente na revisão do import,
// pra pré-preencher os campos (não pra ativar nada sozinho).
// Descarta matches sem sentido (parcela > total, total < 2 ou > 48 — isso
// também evita confundir uma data tipo "01/2026" com parcela, já que
// 2026 > 48) — nesses casos retorna null e o usuário preenche manualmente.
export function detectInstallmentInDescription(descricao: string): DetectedInstallment | null {
    for (const pattern of INSTALLMENT_PATTERNS) {
        const match = descricao.match(pattern);
        if (!match) continue;

        const number = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        if (!(number >= 1 && total >= 2 && number <= total && total <= 48)) continue;

        return { number, total };
    }
    return null;
}

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
