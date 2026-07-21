"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  parseInstallmentPattern,
  getCleanDescription,
  isWithinTolerance,
  calculateScore,
} from "@/lib/matching-utils";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");
  return session.user.id;
}

export async function findMatchingProvisions(params: {
  userId: string;
  csvDescription: string;
  csvValue: number;
  institutionId: string;
}) {
  const { userId, csvDescription, csvValue, institutionId } = params;
  const suggestions: any[] = [];

  const parsed = parseInstallmentPattern(csvDescription);

  const transactionProvisions = await db.transaction.findMany({
    where: {
      userId,
      is_provisioned: true,
      institution_id: institutionId,
      ...(parsed ? { current_installment: parsed.current } : {}),
    },
  });

  for (const prov of transactionProvisions) {
    if (isWithinTolerance(csvValue, Number(prov.valor))) {
      const provClean = getCleanDescription(prov.descricao);
      const csvClean = getCleanDescription(csvDescription);
      const score = calculateScore(provClean, csvClean, csvValue, Number(prov.valor));

      suggestions.push({
        provisionId: prov.id,
        provisionDescription: prov.descricao,
        provisionValue: Number(prov.valor),
        csvValue,
        score,
        type: "transaction" as const,
      });
    }
  }

  const invoiceItemProvisions = await db.creditCardInvoiceItem.findMany({
    where: {
      is_provisioned: true,
      institution_id: institutionId,
      ...(parsed ? { current_installment: parsed.current } : {}),
    },
    include: { transaction: { select: { userId: true } } },
  });

  for (const prov of invoiceItemProvisions) {
    if (prov.transaction?.userId !== userId) continue;

    if (isWithinTolerance(csvValue, Number(prov.valor))) {
      const provClean = getCleanDescription(prov.descricao);
      const csvClean = getCleanDescription(csvDescription);
      const score = calculateScore(provClean, csvClean, csvValue, Number(prov.valor));

      suggestions.push({
        provisionId: prov.id,
        provisionDescription: prov.descricao,
        provisionValue: Number(prov.valor),
        csvValue,
        score,
        type: "invoice_item" as const,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

export async function suggestMatches(
  parsedRows: Array<{ id: number; description: string; amount: number }>,
  userId: string,
  institutionId: string
): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};

  await Promise.all(
    parsedRows.map(async (row) => {
      const matches = await findMatchingProvisions({
        userId,
        csvDescription: row.description,
        csvValue: row.amount,
        institutionId,
      });
      if (matches.length > 0) {
        result[String(row.id)] = matches;
      }
    })
  );

  return result;
}
