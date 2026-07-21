import { Decimal } from "decimal.js";

const INSTALLMENT_PATTERN = /^(.+?)\s*\(?(\d{1,2})\s*[\/\-]\s*(\d{1,2})\)?\s*$/;
const VALUE_TOLERANCE = new Decimal(2.00);

export interface ParsedInstallment {
  current: number;
  total: number;
  cleanDescription: string;
}

export interface MatchSuggestion {
  provisionId: string;
  provisionDescription: string;
  provisionValue: number;
  csvValue: number;
  score: number;
  type: "transaction" | "invoice_item";
}

export function parseInstallmentPattern(descricao: string): ParsedInstallment | null {
  const trimmed = descricao.trim();
  const match = trimmed.match(INSTALLMENT_PATTERN);
  if (!match) return null;

  const current = parseInt(match[2], 10);
  const total = parseInt(match[3], 10);

  if (isNaN(current) || isNaN(total) || current < 1 || total < 2 || current > total) {
    return null;
  }

  return {
    current,
    total,
    cleanDescription: match[1].trim(),
  };
}

export function getCleanDescription(descricao: string): string {
  const parsed = parseInstallmentPattern(descricao);
  return parsed ? parsed.cleanDescription : descricao.trim();
}

export function isWithinTolerance(csvValue: number, provisionValue: number): boolean {
  const diff = new Decimal(csvValue).minus(new Decimal(provisionValue)).abs();
  return diff.lte(VALUE_TOLERANCE);
}

function calculateScore(cleanA: string, cleanB: string, valueA: number, valueB: number): number {
  let score = 0;

  const a = cleanA.toLowerCase().trim();
  const b = cleanB.toLowerCase().trim();

  if (a === b) {
    score += 60;
  } else if (a.includes(b) || b.includes(a)) {
    score += 40;
  } else {
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const common = aWords.filter(w => bWords.includes(w)).length;
    const maxWords = Math.max(aWords.length, bWords.length);
    if (maxWords > 0) {
      score += (common / maxWords) * 40;
    }
  }

  const maxVal = Math.max(valueA, valueB);
  if (maxVal > 0) {
    const diffPct = Math.abs(valueA - valueB) / maxVal;
    if (diffPct <= 0.01) score += 40;
    else if (diffPct <= 0.05) score += 30;
    else if (diffPct <= 0.10) score += 20;
    else score += 10;
  }

  return Math.round(score);
}

export { calculateScore };
