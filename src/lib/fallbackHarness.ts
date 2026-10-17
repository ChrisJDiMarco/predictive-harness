import type {
  BranchTrajectory,
  HarnessApi,
  HarnessEvent,
  HarnessRequest,
  HarnessRunSnapshot,
  ProviderId,
  ProviderStatus,
  RoutingDecision,
} from '../shared/types';

const providers: ProviderStatus[] = [
  provider('anthropic', 'Anthropic', 'Claude', 'sk-ant-...', 'Claude Sonnet 4'),
  provider('openai', 'OpenAI', 'GPT', 'sk-...', 'GPT-5 Mini'),
  provider('gemini', 'Google Gemini', 'Gemini', 'AIza...', 'Gemini 2.5 Flash'),
  provider('deepseek', 'DeepSeek', 'DeepSeek', 'sk-...', 'DeepSeek V4 Flash'),
  provider('glm', 'Z.ai GLM', 'GLM', 'glm-...', 'GLM-5 Turbo'),
];

const listeners = new Map<string, Set<(event: HarnessEvent) => void>>();

export const fallbackHarness: HarnessApi = {
  getProviders: async () => cloneProviders(),
  saveProviderKey: async (providerId, apiKey) => {
    const target = providers.find((item) => item.id === providerId);
    if (target) {
      target.hasKey = Boolean(apiKey.trim());
      target.encryptedAt = target.hasKey ? new Date().toISOString() : undefined;
    }
    return cloneProviders();
  },
  clearProviderKey: async (providerId) => {
    const target = providers.find((item) => item.id === providerId);
    if (target) {
      target.hasKey = false;
      target.encryptedAt = undefined;
    }
    return cloneProviders();
  },
  startRun: async (request) => {
    const runId = crypto.randomUUID();
    setTimeout(() => simulateRun(runId, request), 40);
    return runId;
  },
  onRunEvent: (runId, callback) => {
    const nextListeners = listeners.get(runId) ?? new Set();
    nextListeners.add(callback);
    listeners.set(runId, nextListeners);
    return () => nextListeners.delete(callback);
  },
};

export function getHarnessApi(): HarnessApi {
  return window.harness ?? fallbackHarness;
}

function provider(id: ProviderId, label: string, shortLabel: string, keyHint: string, modelLabel: string): ProviderStatus {
  return {
    id,
    label,
    shortLabel,
    keyHint,
    baseUrl: '',
    hasKey: false,
    models: [
      {
        providerId: id,
        modelId: modelLabel.toLowerCase().replace(/\s+/g, '-'),
        label: modelLabel,
        tier: 'balanced',
        contextWindow: 128_000,
        capabilities: {
          reasoning: 0.8,
          simulation: 0.8,
          safety: 0.8,
          code: 0.8,
          creativity: 0.72,
          context: 0.75,
          latency: 0.8,
          cost: 0.78,
        },
      },
    ],
  };
}

function cloneProviders(): ProviderStatus[] {
  return providers.map((item) => ({
    ...item,
    models: item.models.map((model) => ({ ...model, capabilities: { ...model.capabilities } })),
  }));
}

function simulateRun(runId: string, request: HarnessRequest) {
  const route: RoutingDecision[] = [
    routeNode('proposer', 'Local Simulator'),
    routeNode('worldModel', 'Local Simulator'),
    routeNode('evaluator', 'Local Simulator'),
    routeNode('synthesizer', 'Local Simulator'),
  ];
  const branches: BranchTrajectory[] = [
    branch('branch-1', 'Shortest Safe Commit', 'Minimize moving parts and commit reversible work first.', 0.84, 'winner'),
    branch('branch-2', 'Adversarial Search', 'Stress-test the plan with hard evaluator gates.', 0.71, 'complete'),
    branch('branch-3', 'Cost-Optimized Cascade', 'Use cheap breadth first and escalate ambiguity.', 0.52, 'pruned'),
  ].slice(0, request.branchFactor);

  const snapshot: HarnessRunSnapshot = {
    runId,
    status: 'routing',
    mode: request.mode,
    objective: request.objective,
    route,
    branches: [],
    trace: [],
    metrics: {
      hiddenCalls: 0,
      prunedBranches: 0,
      estimatedTokens: 0,
      elapsedMs: 0,
      engramHits: 0,
      compressionSavings: 0,
      learnedRules: 0,
    },
    cognition: {
      memoryMode: 'cold-start',
      memoryHits: [],
      injectedConstraints: [],
      learnedHeuristics: [],
      simulatorRoutes: [],
      compressionSavings: 0,
    },
  };

  const publish = (eventType: HarnessEvent['type'] = 'snapshot') => {
    listeners.get(runId)?.forEach((listener) => listener({ type: eventType, snapshot: structuredClone(snapshot) }));
  };

  publish();
  setTimeout(() => {
    snapshot.status = 'simulating';
    snapshot.branches = branches;
    snapshot.metrics = {
      hiddenCalls: 16,
      prunedBranches: 1,
      estimatedTokens: 24_800,
      elapsedMs: 620,
      engramHits: 0,
      compressionSavings: 4_200,
      learnedRules: 1,
    };
    snapshot.cognition = {
      memoryMode: 'negative-constraint',
      memoryHits: [],
      injectedConstraints: ['Avoid prior high-risk branch patterns.'],
      learnedHeuristics: ['Require reversible checkpoint before high-risk commit.'],
      simulatorRoutes: [
        {
          domain: 'logic',
          mcpServer: 'foundation-logic-mcp',
          confidence: 0.68,
          reason: 'Fallback browser simulation route.',
        },
      ],
      compressionSavings: 4_200,
    };
    snapshot.trace = [
      {
        id: 'fallback-1',
        timestamp: new Date().toISOString(),
        role: 'evaluator',
        providerId: 'local',
        modelId: 'offline-simulator',
        title: 'Prune Cost-Optimized Cascade',
        detail: 'Branch fell below objective-fit threshold after risk adjustment.',
        status: 'warning',
        latencyMs: 82,
      },
      {
        id: 'fallback-2',
        timestamp: new Date().toISOString(),
        role: 'worldModel',
        providerId: 'local',
        modelId: 'offline-simulator',
        title: 'Simulate Shortest Safe Commit',
        detail: 'Predicted reversible state change with clean audit checkpoint.',
        status: 'complete',
        latencyMs: 74,
      },
    ];
    publish();
  }, 450);

  setTimeout(() => {
    snapshot.status = 'complete';
    snapshot.finalAnswer = `Committed trajectory: Shortest Safe Commit\n\n1. Define acceptance test\n2. Build minimal execution path\n3. Simulate the highest-risk transition\n\nObjective fit: 84%. Peak risk: 28%.`;
    snapshot.metrics.elapsedMs = 940;
    publish('done');
  }, 900);
}

function routeNode(role: RoutingDecision['role'], label: string): RoutingDecision {
  return {
    role,
    providerId: 'local',
    modelId: 'offline-simulator',
    label,
    score: 0.72,
    reason: 'Browser fallback route.',
  };
}

function branch(id: string, title: string, stance: string, score: number, status: BranchTrajectory['status']): BranchTrajectory {
  return {
    id,
    title,
    stance,
    status,
    score,
    risk: status === 'pruned' ? 0.76 : 0.28,
    currentState: `${title} produced a simulated trajectory with auditable state transitions and evaluator feedback.`,
    steps: [
      {
        id: `${id}-1`,
        index: 1,
        action: 'Define acceptance test',
        intent: 'Make the target measurable',
        predictedState: 'Acceptance checks are explicit.',
        consequences: ['The objective becomes testable.'],
        sideEffects: ['Adds one planning checkpoint.'],
        confidence: 0.84,
        evaluation: {
          score,
          goalFit: score,
          risk: 0.28,
          cost: 0.22,
          verdict: status === 'pruned' ? 'prune' : 'continue',
          rationale: status === 'pruned' ? 'Risk exceeded configured tolerance.' : 'Branch stays inside the configured envelope.',
          violations: [],
        },
      },
      {
        id: `${id}-2`,
        index: 2,
        action: 'Simulate risky transition',
        intent: 'Expose second-order effects',
        predictedState: 'Consequences are visible before commit.',
        consequences: ['Evaluator can compare predicted states.'],
        sideEffects: ['Consumes hidden calls.'],
        confidence: 0.78,
        evaluation: {
          score,
          goalFit: score,
          risk: 0.31,
          cost: 0.26,
          verdict: status === 'winner' ? 'commit' : 'continue',
          rationale: 'Simulation improved confidence.',
          violations: [],
        },
      },
    ],
  };
}
