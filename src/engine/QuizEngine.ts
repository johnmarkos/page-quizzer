import type {
  Problem,
  Answer,
  Score,
  SessionSummary,
  EngineState,
  EngineEvent,
  EngineEventPayloads,
  EngineSnapshot,
} from './types.js';
import { shuffle } from './utils.js';

type Listener<E extends EngineEvent> = (payload: EngineEventPayloads[E]) => void;

export class QuizEngine {
  #state: EngineState = 'idle';
  #problems: Problem[] = [];
  #currentIndex = 0;
  #answers: Answer[] = [];
  #startedAt = 0;
  #listeners = new Map<EngineEvent, Set<Listener<any>>>();

  get state(): EngineState {
    return this.#state;
  }

  get currentProblem(): Problem | null {
    if (this.#state === 'idle' || this.#state === 'complete') return null;
    return this.#problems[this.#currentIndex] ?? null;
  }

  get currentIndex(): number {
    return this.#currentIndex;
  }

  get totalProblems(): number {
    return this.#problems.length;
  }

  get score(): Score {
    const correct = this.#answers.filter(a => a.correct).length;
    const incorrect = this.#answers.filter(a => !a.correct).length;
    const skipped = this.#problems.length - this.#answers.length;
    const total = this.#problems.length;
    return {
      correct,
      incorrect,
      skipped,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }

  on<E extends EngineEvent>(event: E, fn: Listener<E>): void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event)!.add(fn);
  }

  off<E extends EngineEvent>(event: E, fn: Listener<E>): void {
    this.#listeners.get(event)?.delete(fn);
  }

  #emit<E extends EngineEvent>(event: E, payload: EngineEventPayloads[E]): void {
    this.#listeners.get(event)?.forEach(fn => fn(payload));
  }

  #transition(to: EngineState): void {
    const from = this.#state;
    this.#state = to;
    this.#emit('stateChange', { from, to });
  }

  loadProblems(problems: Problem[]): void {
    this.#problems = problems.map(p => ({
      ...p,
      options: [...p.options],
    }));
    this.#currentIndex = 0;
    this.#answers = [];
    this.#transition('idle');
  }

  start(shuffleProblems = true): void {
    if (this.#problems.length === 0) return;
    if (shuffleProblems) {
      this.#problems = shuffle(this.#problems);
      this.#problems = this.#problems.map(p => ({
        ...p,
        options: shuffle(p.options),
      }));
    }
    this.#currentIndex = 0;
    this.#answers = [];
    this.#startedAt = Date.now();
    this.#transition('practicing');
    this.#showCurrentQuestion();
  }

  selectOption(optionIndex: number): void {
    if (this.#state !== 'practicing') return;
    const problem = this.#problems[this.#currentIndex];
    if (!problem) return;

    const correct = problem.options[optionIndex]?.correct ?? false;
    const correctIndex = problem.options.findIndex(o => o.correct);

    this.#answers.push({
      problemId: problem.id,
      selectedIndex: optionIndex,
      correct,
    });

    this.#transition('answered');
    this.#emit('answerResult', {
      correct,
      correctIndex,
      explanation: problem.explanation,
    });
  }

  next(): void {
    if (this.#state !== 'answered') return;
    this.#currentIndex++;
    if (this.#currentIndex >= this.#problems.length) {
      this.#complete();
    } else {
      this.#transition('practicing');
      this.#showCurrentQuestion();
    }
  }

  skip(): void {
    if (this.#state !== 'practicing') return;
    this.#currentIndex++;
    if (this.#currentIndex >= this.#problems.length) {
      this.#complete();
    } else {
      this.#showCurrentQuestion();
    }
  }

  /** Serialize engine state for persistence (e.g., across service worker restarts) */
  serialize(): EngineSnapshot {
    return {
      state: this.#state,
      problems: this.#problems.map(p => ({ ...p, options: [...p.options] })),
      currentIndex: this.#currentIndex,
      answers: [...this.#answers],
      startedAt: this.#startedAt,
    };
  }

  /** Restore engine from a serialized snapshot. Does not emit events. */
  restore(snapshot: EngineSnapshot): void {
    this.#state = snapshot.state;
    this.#problems = snapshot.problems.map(p => ({ ...p, options: [...p.options] }));
    this.#currentIndex = snapshot.currentIndex;
    this.#answers = [...snapshot.answers];
    this.#startedAt = snapshot.startedAt;
  }

  #showCurrentQuestion(): void {
    const problem = this.#problems[this.#currentIndex];
    if (!problem) return;
    this.#emit('questionShow', {
      problem,
      index: this.#currentIndex,
      total: this.#problems.length,
    });
  }

  #complete(): void {
    const summary: SessionSummary = {
      score: this.score,
      answers: [...this.#answers],
      startedAt: this.#startedAt,
      completedAt: Date.now(),
    };
    this.#transition('complete');
    this.#emit('quizComplete', summary);
  }
}
