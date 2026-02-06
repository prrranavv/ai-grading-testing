export interface RubricLevel {
  basisForEvaluation: string;
  columnName?: string;
  maxScore: number;
}

export interface RubricCriterion {
  criterionName: string;
  levels: RubricLevel[];
}

export interface RubricResult {
  name?: string;
  subject?: string[];
  grade?: string[];
  rubricTable?: RubricCriterion[];
  raw?: string;
}

export interface RunRecord {
  id: string;
  timestamp: number;
  input: {
    fileName?: string;
    textSnippet?: string;
  };
  prompts: {
    system: string;
    user: string;
  };
  result: RubricResult | null;
  error?: string;
}
