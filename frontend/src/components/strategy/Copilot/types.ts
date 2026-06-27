import type { StrategySummary, StrategyJsonObject } from "@/lib/strategyApi";

export type CopilotMode = "modify" | "optimize" | "explain";

export interface StrategyCopilotProps {
  currentStrategy: StrategySummary | null;
  currentCode: string;
  onCodeChange: (code: string) => void;
  onSchemaChange?: (schema: StrategyJsonObject) => void;
}

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface ModificationResult {
  code: string;
  changes: string[];
  parameters_schema: StrategyJsonObject;
  is_valid: boolean;
  errors: string[];
  base_template: string;
}

export interface OptimizationResult {
  code: string;
  analysis: string;
  suggestions: string[];
  is_valid: boolean;
  errors: string[];
}

export interface ExplanationResult {
  explanation: string;
  raw?: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  result?: ModificationResult | OptimizationResult | ExplanationResult;
}
