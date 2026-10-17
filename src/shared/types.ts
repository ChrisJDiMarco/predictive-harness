export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'glm';

export type HarnessRole = 'proposer' | 'worldModel' | 'evaluator' | 'synthesizer';

export type RunMode = 'offline' | 'live';

export type BranchStatus = 'queued' | 'running' | 'pruned' | 'complete' | 'winner';

export type SimulatorDomain = 'code' | 'math' | 'spatial' | 'visual' | 'logic' | 'general';

export interface ModelCapabilities {
  reasoning: number;
  simulation: number;
  safety: number;
  code: number;
  creativity: number;
  context: number;
  latency: number;
  cost: number;
}

export interface ModelProfile {
  providerId: ProviderId;
  modelId: string;
  label: string;
  tier: 'frontier' | 'balanced' | 'fast' | 'bulk';
  contextWindow: number;
  capabilities: ModelCapabilities;
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  shortLabel: string;
  keyHint: string;
  baseUrl: string;
  hasKey: boolean;
  encryptedAt?: string;
  models: ModelProfile[];
}

export interface RoutingDecision {
  role: HarnessRole;
  providerId: ProviderId | 'local';
  modelId: string;
  label: string;
  score: number;
  reason: string;
}

export interface HarnessRequest {
  objective: string;
  currentState: string;
  constraints: string[];
  mode: RunMode;
  branchFactor: number;
  depth: number;
  riskTolerance: number;
  budgetMode: 'quality' | 'balanced' | 'economy';
}

export interface CandidateStep {
  id: string;
  action: string;
  intent: string;
  risk: 'low' | 'medium' | 'high';
}

export interface CandidatePlan {
  id: string;
  title: string;
  stance: string;
  steps: CandidateStep[];
}

export interface StepEvaluation {
  score: number;
  goalFit: number;
  risk: number;
  cost: number;
  verdict: 'continue' | 'prune' | 'commit';
  rationale: string;
  violations: string[];
  critique?: string;
  heuristicPatch?: string;
}

export interface SimulatorRoute {
  domain: SimulatorDomain;
  mcpServer: string;
  confidence: number;
  reason: string;
}

export interface CompressedState {
  summary: string;
  affectedVariables: string[];
  droppedTokenEstimate: number;
}

export interface SimulatedStep {
  id: string;
  index: number;
  action: string;
  intent: string;
  predictedState: string;
  consequences: string[];
  sideEffects: string[];
  confidence: number;
  simulatorRoute?: SimulatorRoute;
  compressedState?: CompressedState;
  evaluation?: StepEvaluation;
}

export interface BranchTrajectory {
  id: string;
  title: string;
  stance: string;
  status: BranchStatus;
  score: number;
  risk: number;
  currentState: string;
  steps: SimulatedStep[];
}

export interface TraceEntry {
  id: string;
  timestamp: string;
  role: HarnessRole | 'orchestrator';
  providerId: ProviderId | 'local';
  modelId: string;
  title: string;
  detail: string;
  status: 'running' | 'complete' | 'warning' | 'error';
  latencyMs?: number;
  tokens?: number;
}

export interface RunMetrics {
  hiddenCalls: number;
  prunedBranches: number;
  estimatedTokens: number;
  elapsedMs: number;
  engramHits?: number;
  compressionSavings?: number;
  learnedRules?: number;
}

export interface CognitiveMemoryHit {
  id: string;
  kind: 'success' | 'failure';
  similarity: number;
  score: number;
  title: string;
  lesson: string;
}

export interface CognitiveSnapshot {
  memoryMode: 'cold-start' | 'macro-replay' | 'negative-constraint' | 'assisted';
  memoryHits: CognitiveMemoryHit[];
  injectedConstraints: string[];
  learnedHeuristics: string[];
  simulatorRoutes: SimulatorRoute[];
  compressionSavings: number;
}

export interface HarnessRunSnapshot {
  runId: string;
  status: 'idle' | 'routing' | 'proposing' | 'simulating' | 'evaluating' | 'synthesizing' | 'complete' | 'error';
  mode: RunMode;
  objective: string;
  route: RoutingDecision[];
  branches: BranchTrajectory[];
  trace: TraceEntry[];
  metrics: RunMetrics;
  cognition?: CognitiveSnapshot;
  finalAnswer?: string;
  error?: string;
}

export type HarnessEvent =
  | { type: 'snapshot'; snapshot: HarnessRunSnapshot }
  | { type: 'done'; snapshot: HarnessRunSnapshot }
  | { type: 'error'; snapshot: HarnessRunSnapshot };

export interface HarnessApi {
  getProviders: () => Promise<ProviderStatus[]>;
  saveProviderKey: (providerId: ProviderId, apiKey: string) => Promise<ProviderStatus[]>;
  clearProviderKey: (providerId: ProviderId) => Promise<ProviderStatus[]>;
  startRun: (request: HarnessRequest) => Promise<string>;
  onRunEvent: (runId: string, callback: (event: HarnessEvent) => void) => () => void;
}
