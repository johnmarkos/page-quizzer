import { STORAGE_KEYS } from '../shared/constants.js';
import type { ContentSection } from '../shared/messages.js';
import type { Score } from '../engine/types.js';

export type SectionProgressRecord = {
  index: number;
  title: string;
  wordCount: number;
  quizzed: boolean;
  scorePercentage?: number;
  lastQuizzed?: number;
};

export type DocumentProgressRecord = {
  url: string;
  title: string;
  sections: SectionProgressRecord[];
};

export type DocumentProgressMap = Record<string, DocumentProgressRecord>;

export type ProgressSummary = {
  completedCount: number;
  totalCount: number;
  averageScorePercentage: number | null;
};

export type DocumentResumeState = ProgressSummary & {
  title: string;
  nextSectionIndex: number | null;
  nextSectionTitle?: string;
  allSectionsCompleted: boolean;
};

export type DocumentLibraryItem = DocumentResumeState & {
  url: string;
  lastActivity: number | null;
};

export class ProgressManager {
  async getDocumentProgress(url: string): Promise<DocumentProgressRecord | null> {
    const allProgress = await this.#getAllProgress();
    return allProgress[url] ? cloneDocumentProgress(allProgress[url]) : null;
  }

  async listDocuments(): Promise<DocumentLibraryItem[]> {
    const allProgress = await this.#getAllProgress();
    return buildDocumentLibraryItems(Object.values(allProgress));
  }

  async recordSectionResult(
    url: string,
    title: string,
    sections: ContentSection[],
    sectionIndex: number,
    score: Score,
    completedAt: number,
  ): Promise<DocumentProgressRecord> {
    const allProgress = await this.#getAllProgress();
    const updated = updateDocumentProgressRecord(
      allProgress[url] ?? null,
      url,
      title,
      sections,
      sectionIndex,
      score,
      completedAt,
    );
    allProgress[url] = updated;
    await chrome.storage.local.set({ [STORAGE_KEYS.DOCUMENT_PROGRESS]: allProgress });
    return cloneDocumentProgress(updated);
  }

  async buildSectionProgress(url: string, sections: ContentSection[]): Promise<{
    sections: ContentSection[];
    summary: ProgressSummary;
  }> {
    const allProgress = await this.#getAllProgress();
    const mergedSections = mergeSectionProgress(sections, allProgress[url] ?? null);
    return {
      sections: mergedSections,
      summary: buildProgressSummary(mergedSections),
    };
  }

  async #getAllProgress(): Promise<DocumentProgressMap> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.DOCUMENT_PROGRESS);
    return (data[STORAGE_KEYS.DOCUMENT_PROGRESS] as DocumentProgressMap | undefined) ?? {};
  }
}

export function updateDocumentProgressRecord(
  existing: DocumentProgressRecord | null,
  url: string,
  title: string,
  sections: ContentSection[],
  sectionIndex: number,
  score: Score,
  completedAt: number,
): DocumentProgressRecord {
  const mergedSections = mergeSectionProgress(sections, existing).map((section) => {
    if (section.index !== sectionIndex) {
      return section;
    }

    return {
      ...section,
      quizzed: true,
      scorePercentage: score.percentage,
      lastQuizzed: completedAt,
    };
  });

  return {
    url,
    title,
    sections: mergedSections.map(toSectionProgressRecord),
  };
}

export function mergeSectionProgress(
  sections: ContentSection[],
  existing: DocumentProgressRecord | null,
): ContentSection[] {
  return sections.map((section) => {
    const existingSection = existing?.sections.find((candidate) => candidate.index === section.index);

    return {
      ...section,
      quizzed: existingSection?.quizzed ?? false,
      scorePercentage: existingSection?.scorePercentage,
      lastQuizzed: existingSection?.lastQuizzed,
    };
  });
}

export function buildProgressSummary(sections: Array<Pick<SectionProgressRecord, 'quizzed' | 'scorePercentage'>>): ProgressSummary {
  const completedSections = sections.filter((section) => section.quizzed);
  const scoredSections = completedSections.filter(
    (section): section is Pick<SectionProgressRecord, 'quizzed'> & { scorePercentage: number } =>
      typeof section.scorePercentage === 'number',
  );

  const averageScorePercentage = scoredSections.length > 0
    ? Math.round(scoredSections.reduce((sum, section) => sum + section.scorePercentage, 0) / scoredSections.length)
    : null;

  return {
    completedCount: completedSections.length,
    totalCount: sections.length,
    averageScorePercentage,
  };
}

export function buildDocumentResumeState(record: DocumentProgressRecord): DocumentResumeState {
  const summary = buildProgressSummary(record.sections);
  const nextSection = record.sections.find((section) => !section.quizzed) ?? null;

  return {
    title: record.title,
    completedCount: summary.completedCount,
    totalCount: summary.totalCount,
    averageScorePercentage: summary.averageScorePercentage,
    nextSectionIndex: nextSection?.index ?? null,
    nextSectionTitle: nextSection?.title,
    allSectionsCompleted: nextSection === null && summary.totalCount > 0,
  };
}

export function buildDocumentLibraryItems(records: DocumentProgressRecord[]): DocumentLibraryItem[] {
  return records
    .map((record) => {
      const resumeState = buildDocumentResumeState(record);
      const lastActivity = record.sections.reduce<number | null>((latest, section) => {
        if (typeof section.lastQuizzed !== 'number') {
          return latest;
        }

        return latest === null ? section.lastQuizzed : Math.max(latest, section.lastQuizzed);
      }, null);

      return {
        url: record.url,
        lastActivity,
        ...resumeState,
      };
    })
    .sort((left, right) => {
      const leftActivity = left.lastActivity ?? 0;
      const rightActivity = right.lastActivity ?? 0;
      if (rightActivity !== leftActivity) {
        return rightActivity - leftActivity;
      }

      return left.title.localeCompare(right.title);
    });
}

function cloneDocumentProgress(record: DocumentProgressRecord): DocumentProgressRecord {
  return {
    ...record,
    sections: record.sections.map(cloneSectionProgressRecord),
  };
}

function cloneSectionProgressRecord(record: SectionProgressRecord): SectionProgressRecord {
  return { ...record };
}

function toSectionProgressRecord(section: ContentSection): SectionProgressRecord {
  return {
    index: section.index,
    title: section.title,
    wordCount: section.wordCount,
    quizzed: section.quizzed ?? false,
    scorePercentage: section.scorePercentage,
    lastQuizzed: section.lastQuizzed,
  };
}
