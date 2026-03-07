export type QuizGenerationParams = {
  content: string;
  density: number; // questions per 100 words
  maxQuestions: number;
  title?: string;
};

export type RawQuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type QuizGenerationSchema = {
  questions: RawQuizQuestion[];
};

export type TopicCategorizationResult = {
  topics: string[];
};
