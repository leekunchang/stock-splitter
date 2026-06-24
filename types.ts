export interface RatioPart {
  id: string;
  value: number | "";
  label: string;
}

export interface CalculationResult {
  id: string;
  label: string;
  ratio: number;
  percentage: number;
  amountKrw: number;
  amountUsd: number;
}

export interface AiSuggestion {
  title: string;
  description: string;
  ratios: number[];
  labels: string[];
}
