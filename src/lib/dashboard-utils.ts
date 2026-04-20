export const getCategoryGroupName = (name: string) => {
    const n = name.toLowerCase().trim();
    if (n.startsWith("mercado") || n.startsWith("mer")) return "Mercado";
    if (n.startsWith("comida") || n.startsWith("restaurante") || n.startsWith("ifood")) return "Alimentação";
    return n.charAt(0).toUpperCase() + n.slice(1);
};
