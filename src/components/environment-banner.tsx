export function EnvironmentBanner() {
  const dbUrl = process.env.DATABASE_URL || "";
  
  // Condição: Se NÃO for produção OU se o banco não contiver /nxfinance
  const isProduction = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  const isOfficialDB = dbUrl.includes("/nxfinance");

  if (isProduction && isOfficialDB) {
    return null;
  }

  return (
    <div className="bg-orange-600 text-white text-xs font-bold text-center py-1.5 w-full z-[100] relative tracking-wider">
      AMBIENTE DE HOMOLOGAÇÃO - OS DADOS NÃO SÃO REAIS
    </div>
  );
}
