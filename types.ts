export interface QuestionnaireRow {
  list_name: string;
  name: string;
  [key: string]: string; // Capture label columns dynamically
}

export interface ResultRow {
  disaggregation: string;
  // Specific disaggregation columns
  sampling_admin0?: string;
  sampling_admin2?: string; // Kept for backward compatibility if needed, though prompt emphasized admin0
  sampling_value_chain?: string;
  sampling_livelihood?: string;
  firm_owner_gender?: string;
  
  // Question data
  question_type: string;
  question: string;
  answer_option_tag: string;
  indicator: string;
  value: string; // Usually a number string, but kept as string for safety
  sample_size: string;
  se?: string; // Standard Error
  
  // English translations
  question_eng?: string;
  answer_option_eng?: string;
  
  [key: string]: string | undefined;
}

export interface QualitativeAnalysisRow {
  question: string;
  theme: string; // "Executive Summary" or specific theme
  frequency?: number | string; // Can be null/empty for Executive Summary
  total_respondents?: number | string;
  proportion_percent?: number | string;
  summary: string;
  quotes?: string; // Triple dash delimited
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  isLoading?: boolean;
  relatedData?: any[]; // Store data used for this response
}

export enum FileType {
  QUESTIONNAIRE = 'QUESTIONNAIRE',
  RESULTS = 'RESULTS'
}