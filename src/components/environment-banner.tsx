export function EnvironmentBanner() {
  const dbUrl = process.env.DATABASE_URL || "";

  // Condição: Se NÃO for produção OU se o banco não contiver /nxfinance
  const isProduction = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  const isOfficialDB = dbUrl.includes("/nxfinance");

  if (isProduction && isOfficialDB) {
    return null;
  }

  // VERCEL_GIT_COMMIT_SHA é injetado automaticamente pela Vercel no build —
  // não existe em `next dev` local, daí o fallback.
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);

  return (
    <div className="bg-orange-600 text-white text-xs font-bold text-center py-1.5 w-full z-[100] relative tracking-wider">
      AMBIENTE DE HOMOLOGAÇÃO - OS DADOS NÃO SÃO REAIS
      {commit && <span className="font-mono font-normal opacity-70 ml-2">· {commit}</span>}
    </div>
  );
}
