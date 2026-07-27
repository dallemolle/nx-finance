import { NextResponse } from "next/server";

// Endpoint de diagnóstico: confirma exatamente qual commit está rodando no ar,
// sem depender de lembrar se um deploy específico já foi feito. As variáveis
// VERCEL_* são injetadas automaticamente pela Vercel no build — ficam vazias
// em ambiente local (next dev), o que também serve como sinal útil.
export async function GET() {
    return NextResponse.json({
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        commitShort: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? "local",
    });
}
