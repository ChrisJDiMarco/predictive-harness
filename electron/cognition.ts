import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  BranchTrajectory,
  CandidatePlan,
  CandidateStep,
  CognitiveMemoryHit,
  CompressedState,
  HarnessRequest,
  SimulatorDomain,
  SimulatorRoute,
  StepEvaluation,
} from '../src/shared/types';

interface EngramRecord {
  id: string;
  createdAt: string;
  kind: 'success' | 'failure';
  objective: string;
  initialState: string;
  title: string;
  score: number;
  risk: number;
  lesson: string;
  actions: CandidateStep[];
  vector: Record<string, number>;
}

interface HeuristicRecord {
  id: string;
  createdAt: string;
  rule: string;
  critique: string;
  confidence: number;
  tags: string[];
}

interface CognitiveStoreFile {
  engrams: EngramRecord[];
  heuristics: HeuristicRecord[];
}

export interface MemoryRecall {
  mode: 'cold-start' | 'macro-replay' | 'negative-constraint' | 'assisted';
  hits: CognitiveMemoryHit[];
  injectedConstraints: string[];
  macroPlan?: CandidatePlan;
}

const MEMORY_FILE = 'cognitive-memory.json';
const MAX_ENGRAMS = 200;
const MAX_HEURISTICS = 80;

export class CognitiveEngine {
  private cache: CognitiveStoreFile | null = null;

  async recall(request: HarnessRequest): Promise<MemoryRecall> {
    const store = await this.readStore();
    const queryVector = vectorize(`${request.objective}\n${request.currentState}`);
    const ranked = store.engrams
      .map((engram) => ({
        engram,
        similarity: cosineSimilarity(queryVector, engram.vector),
      }))
      .filter((item) => item.similarity >= 0.34)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    const success = ranked.find((item) => item.engram.kind === 'success' && item.engram.score >= 0.72 && item.similarity >= 0.82);
    const failures = ranked.filter((item) => item.engram.kind === 'failure' && item.similarity >= 0.46).slice(0, 3);
    const hits = ranked.map(({ engram, similarity }) => ({
      id: engram.id,
      kind: engram.kind,
      similarity: Number(similarity.toFixed(3)),
      score: engram.score,
      title: engram.title,
      lesson: engram.lesson,
    }));

    if (success) {
      return {
        mode: 'macro-replay',
        hits,
        injectedConstraints: failures.map(({ engram }) => `Avoid prior failed path: ${engram.lesson}`),
        macroPlan: {
          id: `engram-${success.engram.id}`,
          title: `Replay: ${success.engram.title}`,
          stance: `Retrieved successful engram at ${Math.round(success.similarity * 100)}% similarity.`,
          steps: success.engram.actions.map((step, index) => ({
            ...step,
            id: `engram-${success.engram.id}-step-${index + 1}`,
          })),
        },
      };
    }

    if (failures.length > 0) {
      return {
        mode: 'negative-constraint',
        hits,
        injectedConstraints: failures.map(({ engram }) => `Do not repeat: ${engram.lesson}`),
      };
    }

    return {
      mode: ranked.length > 0 ? 'assisted' : 'cold-start',
      hits,
      injectedConstraints: [],
    };
  }

  async relevantHeuristics(request: HarnessRequest): Promise<string[]> {
    const store = await this.readStore();
    const requestTokens = new Set(tokenize(`${request.objective} ${request.currentState}`));
    return store.heuristics
      .map((heuristic) => ({
        heuristic,
        overlap: heuristic.tags.filter((tag) => requestTokens.has(tag)).length,
      }))
      .sort((a, b) => b.overlap - a.overlap || b.heuristic.confidence - a.heuristic.confidence)
      .slice(0, 6)
      .map(({ heuristic }) => heuristic.rule);
  }

  routeSimulator(request: HarnessRequest, step: CandidateStep): SimulatorRoute {
    const text = `${request.objective} ${request.currentState} ${step.action} ${step.intent}`.toLowerCase();
    const domain = classifyDomain(text);

    if (domain === 'code') {
      return {
        domain,
        mcpServer: 'secure-sandbox-mcp',
        confidence: 0.86,
        reason: 'Code or software behavior is best predicted by executable sandbox simulation.',
      };
    }
    if (domain === 'math') {
      return {
        domain,
        mcpServer: 'math-execution-mcp',
        confidence: 0.82,
        reason: 'Quantitative transitions should use deterministic calculation before LLM judgment.',
      };
    }
    if (domain === 'spatial' || domain === 'visual') {
      return {
        domain,
        mcpServer: 'vision-language-simulator-mcp',
        confidence: 0.74,
        reason: 'Spatial or visual state changes need a VLM-style simulator lane.',
      };
    }
    return {
      domain,
      mcpServer: 'foundation-logic-mcp',
      confidence: 0.68,
      reason: 'Abstract state prediction remains on the foundational logic simulator.',
    };
  }

  compressState(currentState: string, objective: string, action: string): CompressedState {
    const keywords = new Set([...tokenize(objective), ...tokenize(action)].filter((token) => token.length > 3));
    const sentences = currentState
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const relevant = sentences.filter((sentence) => tokenize(sentence).some((token) => keywords.has(token))).slice(0, 4);
    const summary = relevant.length > 0 ? relevant.join(' ') : currentState.slice(0, 480);
    const affectedVariables = Array.from(keywords).slice(0, 8);
    const droppedTokenEstimate = Math.max(0, estimateTokens(currentState) - estimateTokens(summary));

    return {
      summary,
      affectedVariables,
      droppedTokenEstimate,
    };
  }

  async spliceCritique(evaluation: StepEvaluation, branch: BranchTrajectory, step: CandidateStep): Promise<string | undefined> {
    const critique = evaluation.critique || evaluation.rationale;
    if (!critique || evaluation.verdict !== 'prune') {
      return undefined;
    }

    const rule = evaluation.heuristicPatch || `Avoid proposing "${step.action}" when evaluator critique is: ${critique}`;
    const store = await this.readStore();
    const normalized = normalize(rule);
    const existing = store.heuristics.find((heuristic) => normalize(heuristic.rule) === normalized);
    if (existing) {
      existing.confidence = clamp(existing.confidence + 0.05, 0.1, 0.98);
      await this.writeStore(store);
      return existing.rule;
    }

    const tags = tokenize(`${branch.title} ${step.action} ${critique}`).slice(0, 16);
    const record: HeuristicRecord = {
      id: randomId('heuristic'),
      createdAt: new Date().toISOString(),
      rule,
      critique,
      confidence: 0.62,
      tags,
    };
    store.heuristics = [record, ...store.heuristics].slice(0, MAX_HEURISTICS);
    await this.writeStore(store);
    return record.rule;
  }

  async recordTrajectory(request: HarnessRequest, branch: BranchTrajectory, kind: 'success' | 'failure', lesson: string): Promise<void> {
    if (branch.steps.length === 0) {
      return;
    }

    const store = await this.readStore();
    const actions = branch.steps.map((step) => ({
      id: step.id,
      action: step.action,
      intent: step.intent,
      risk: inferRisk(step.evaluation?.risk ?? branch.risk),
    }));
    const record: EngramRecord = {
      id: randomId('engram'),
      createdAt: new Date().toISOString(),
      kind,
      objective: request.objective,
      initialState: request.currentState,
      title: branch.title,
      score: branch.score,
      risk: branch.risk,
      lesson,
      actions,
      vector: vectorize(`${request.objective}\n${request.currentState}\n${branch.title}\n${actions.map((step) => step.action).join('\n')}`),
    };

    store.engrams = [record, ...store.engrams].slice(0, MAX_ENGRAMS);
    await this.writeStore(store);
  }

  private async readStore(): Promise<CognitiveStoreFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.storePath(), 'utf8');
      this.cache = JSON.parse(raw) as CognitiveStoreFile;
      this.cache.engrams ??= [];
      this.cache.heuristics ??= [];
      return this.cache;
    } catch {
      this.cache = { engrams: [], heuristics: [] };
      return this.cache;
    }
  }

  private async writeStore(store: CognitiveStoreFile): Promise<void> {
    this.cache = store;
    await mkdir(path.dirname(this.storePath()), { recursive: true });
    await writeFile(this.storePath(), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }

  private storePath(): string {
    return path.join(app.getPath('userData'), MEMORY_FILE);
  }
}

export function memoryContext(recall: MemoryRecall, heuristics: string[]): string {
  const sections = [];
  if (recall.injectedConstraints.length > 0) {
    sections.push(`Negative engrams:\n${recall.injectedConstraints.map((constraint) => `- ${constraint}`).join('\n')}`);
  }
  if (heuristics.length > 0) {
    sections.push(`Proposer heuristics learned from prior evaluator critiques:\n${heuristics.map((rule) => `- ${rule}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

function classifyDomain(text: string): SimulatorDomain {
  if (/\b(code|typescript|javascript|python|api|repo|database|compile|runtime|electron|function|test|build)\b/.test(text)) {
    return 'code';
  }
  if (/\b(math|calculate|price|cost|token|latency|probability|score|budget|forecast|number)\b/.test(text)) {
    return 'math';
  }
  if (/\b(layout|screen|position|map|spatial|physics|collision|movement|camera)\b/.test(text)) {
    return 'spatial';
  }
  if (/\b(image|visual|screenshot|video|render|design|ui|canvas|color)\b/.test(text)) {
    return 'visual';
  }
  if (/\b(strategy|logic|reason|constraint|plan|policy|decision)\b/.test(text)) {
    return 'logic';
  }
  return 'general';
}

function vectorize(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const vector: Record<string, number> = {};
  for (const token of tokens) {
    vector[token] = (vector[token] ?? 0) + 1;
  }
  const magnitude = Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0)) || 1;
  for (const token of Object.keys(vector)) {
    vector[token] = vector[token] / magnitude;
  }
  return vector;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  for (const [token, value] of Object.entries(a)) {
    dot += value * (b[token] ?? 0);
  }
  return dot;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function inferRisk(risk: number): CandidateStep['risk'] {
  if (risk > 0.64) {
    return 'high';
  }
  if (risk > 0.34) {
    return 'medium';
  }
  return 'low';
}

function normalize(text: string): string {
  return tokenize(text).join(' ');
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'must',
  'should',
  'when',
  'then',
  'than',
  'only',
  'have',
  'has',
  'are',
  'was',
  'were',
  'will',
  'not',
  'but',
  'you',
  'your',
  'our',
  'its',
]);
