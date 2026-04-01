export function EnvironmentBanner() {
  const dbUrl = process.env.DATABASE_URL || "";
  
  // Vamos considerar que o banco oficial de produção se chama nx_finance.
  // Se a URL do banco não contiver esse nome, estamos em ambiente de teste/homologação.
  const isProductionDB = dbUrl.includes("nx_finance");

  // Outra forma segura de garantir que na Vercel "production" não exiba isso, caso o nome do banco mude.
  const isVercelProd = process.env.VERCEL_ENV === "production";

  if (isProductionDB || isVercelProd) {
    return null;
  }

  return (
    <div className="bg-orange-600 text-white text-xs font-bold text-center py-1.5 w-full z-[100] relative tracking-wider">
      AMBIENTE DE HOMOLOGAÇÃO - OS DADOS NÃO SÃO REAIS
    </div>
  );
}
