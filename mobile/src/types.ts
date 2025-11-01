export type AnalysisResult = {
  text: string;
  summary: string[];
  headings?: string[];
  enrichment?: {
    entities: Array<{ type: string; name: string; year?: number | null; extra?: any }>;
    sources: Array<{
      provider: string;
      title: string;
      url?: string | null;
      description?: string;
      image?: string | null;
      meta?: any;
    }>;
  };
};
