import { randomUUID } from 'node:crypto';
import type {
  BranchTrajectory,
  CandidatePlan,
  CandidateStep,
  HarnessEvent,
  HarnessRequest,
  HarnessRole,
  HarnessRunSnapshot,
  ProviderId,
  ProviderStatus,
  RoutingDecision,
  SimulatedStep,
  StepEvaluation,
  TraceEntry,
  SimulatorRoute,
  CompressedState,
} from '../src/shared/types';
import { CognitiveEngine, memoryContext, type MemoryRecall } from './cognition';
import { callModel, routeModels } from './providers';

type Emit = (event: HarnessEvent) => void;
type GetKey = (providerId: ProviderId) => Promise<string | undefined>;

interface WorldPrediction {
  predictedState: string;
  consequences: string[];
  sideEffects: string[];
  confidence: number;
  simulatorRoute?: SimulatorRoute;
  compressedState?: CompressedState;
}

export async function runHarness(
  request: HarnessRequest,
  statuses: ProviderStatus[],
  getKey: GetKey,
  emit: Emit,
  runId = randomUUID(),
): Promise<void> {
  const startedAt = Date.now();
  const cognition = new CognitiveEngine();
  const route = routeModels(request, statuses);
  const recall = await cognition.recall(request);
  const heuristics = await cognition.relevantHeuristics(request);
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
      engramHits: recall.hits.length,
      compressionSavings: 0,
      learnedRules: heuristics.length,
    },
    cognition: {
      memoryMode: recall.mode,
      memoryHits: recall.hits,
      injectedConstraints: recall.injectedConstraints,
      learnedHeuristics: heuristics,
      simulatorRoutes: [],
      compressionSavings: 0,
    },
  };

  const publish = (type: HarnessEvent['type'] = 'snapshot') => {
    snapshot.metrics.elapsedMs = Date.now() - startedAt;
    emit({ type, snapshot: clone(snapshot) });
  };

  addTrace(snapshot, {
    role: 'orchestrator',
    providerId: 'local',
    modelId: 'state-machine',
    title: 'Route objective through model mesh',
    detail: `${route.length} functional nodes assigned across ${new Set(route.map((item) => item.providerId)).size} provider lane(s).`,
    status: 'complete',
  });
  if (recall.hits.length > 0) {
    addTrace(snapshot, {
      role: 'orchestrator',
      providerId: 'local',
      modelId: 'engram-memory',
      title: `Recall ${recall.mode}`,
      detail: `${recall.hits.length} similar trajectory engram(s) found. ${recall.injectedConstraints.length} negative constraint(s) injected.`,
      status: recall.mode === 'macro-replay' ? 'complete' : 'warning',
    });
  }
  publish();

  snapshot.status = 'proposing';
  const plans = recall.macroPlan
    ? [recall.macroPlan]
    : await proposePlans(request, route, snapshot, getKey, publish, recall, heuristics);
  snapshot.branches = plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    stance: plan.stance,
    status: 'queued',
    score: 0,
    risk: 0,
    currentState: request.currentState,
    steps: [],
  }));
  publish();

  snapshot.status = 'simulating';
  for (const plan of plans) {
    const branch = snapshot.branches.find((candidate) => candidate.id === plan.id);
    if (!branch) {
      continue;
    }

    branch.status = 'running';
    publish();

    for (const [index, step] of plan.steps.entries()) {
      const prediction = await predictWorldState(request, route, branch, step, snapshot, getKey, publish, cognition);
      const simulatedStep: SimulatedStep = {
        id: step.id,
        index: index + 1,
        action: step.action,
        intent: step.intent,
        predictedState: prediction.predictedState,
        consequences: prediction.consequences,
        sideEffects: prediction.sideEffects,
        confidence: prediction.confidence,
        simulatorRoute: prediction.simulatorRoute,
        compressedState: prediction.compressedState,
      };

      branch.steps.push(simulatedStep);
      branch.currentState = prediction.predictedState;
      publish();

      snapshot.status = 'evaluating';
      const evaluation = await evaluateStep(request, route, branch, simulatedStep, snapshot, getKey, publish);
      simulatedStep.evaluation = evaluation;
      branch.score = Number(((branch.score * index + evaluation.score) / (index + 1)).toFixed(2));
      branch.risk = Number(Math.max(branch.risk, evaluation.risk).toFixed(2));

      if (evaluation.verdict === 'prune') {
        branch.status = 'pruned';
        snapshot.metrics.prunedBranches += 1;
        const learnedRule = await cognition.spliceCritique(evaluation, branch, step);
        if (learnedRule) {
          snapshot.cognition?.learnedHeuristics.unshift(learnedRule);
          snapshot.metrics.learnedRules = snapshot.cognition?.learnedHeuristics.length ?? snapshot.metrics.learnedRules;
          addTrace(snapshot, {
            role: 'evaluator',
            providerId: 'local',
            modelId: 'code-crispr',
            title: 'Splice proposer heuristic',
            detail: learnedRule,
            status: 'complete',
          });
        }
        await cognition.recordTrajectory(request, branch, 'failure', evaluation.critique || evaluation.rationale);
        addTrace(snapshot, {
          role: 'evaluator',
          providerId: routeFor(route, 'evaluator').providerId,
          modelId: routeFor(route, 'evaluator').modelId,
          title: `Prune ${branch.title}`,
          detail: evaluation.rationale,
          status: 'warning',
        });
        publish();
        break;
      }

      snapshot.status = 'simulating';
    }

    if (branch.status === 'running') {
      branch.status = 'complete';
      publish();
    }
  }

  const viable = snapshot.branches
    .filter((branch) => branch.status === 'complete')
    .sort((a, b) => b.score - a.score || a.risk - b.risk);
  const winner = viable[0] ?? snapshot.branches.sort((a, b) => b.score - a.score)[0];

  if (winner) {
    winner.status = 'winner';
  }

  snapshot.status = 'synthesizing';
  snapshot.finalAnswer = await synthesizeAnswer(request, route, snapshot, winner, getKey, publish);
  if (winner) {
    await cognition.recordTrajectory(
      request,
      winner,
      winner.score >= 0.7 ? 'success' : 'failure',
      winner.score >= 0.7
        ? `Successful macro-action: ${winner.steps.map((step) => step.action).join(' -> ')}`
        : `Low-confidence trajectory: ${winner.steps.map((step) => step.action).join(' -> ')}`,
    );
  }
  snapshot.status = 'complete';
  addTrace(snapshot, {
    role: 'orchestrator',
    providerId: 'local',
    modelId: 'commit-controller',
    title: 'Commit trajectory',
    detail: winner ? `${winner.title} selected at ${Math.round(winner.score * 100)}% objective fit.` : 'No viable branch survived evaluation.',
    status: winner ? 'complete' : 'warning',
  });
  publish('done');
}

async function proposePlans(
  request: HarnessRequest,
  route: RoutingDecision[],
  snapshot: HarnessRunSnapshot,
  getKey: GetKey,
  publish: () => void,
  recall: MemoryRecall,
  heuristics: string[],
): Promise<CandidatePlan[]> {
  const decision = routeFor(route, 'proposer');
  const memory = memoryContext(recall, heuristics);
  const prompt = `Current State:\n${request.currentState}\n\nTarget Objective:\n${request.objective}\n\nConstraints:\n${request.constraints.join('\n')}\n\n${memory ? `Persistent Memory Context:\n${memory}\n\n` : ''}Generate ${request.branchFactor} mutually exclusive candidate plans. Each plan must have a title, stance, and ${request.depth} concise action steps. Return only JSON with this shape: [{"title":"","stance":"","steps":[{"action":"","intent":"","risk":"low|medium|high"}]}].`;
  const text = await maybeCallLiveModel(request, decision, getKey, snapshot, publish, 'Generate candidate trajectories', 'Return divergent plans, not the final answer.', prompt, 1_600);
  const parsed = text ? parseJson<any[]>(text) : undefined;
  const plans = normalizePlans(parsed, request);
  return plans.length > 0 ? plans : fallbackPlans(request);
}

async function predictWorldState(
  request: HarnessRequest,
  route: RoutingDecision[],
  branch: BranchTrajectory,
  step: CandidateStep,
  snapshot: HarnessRunSnapshot,
  getKey: GetKey,
  publish: () => void,
  cognition: CognitiveEngine,
): Promise<WorldPrediction> {
  const decision = routeFor(route, 'worldModel');
  const simulatorRoute = cognition.routeSimulator(request, step);
  const compressedState = cognition.compressState(branch.currentState, request.objective, step.action);
  snapshot.metrics.compressionSavings = (snapshot.metrics.compressionSavings ?? 0) + compressedState.droppedTokenEstimate;
  if (snapshot.cognition) {
    snapshot.cognition.compressionSavings += compressedState.droppedTokenEstimate;
    snapshot.cognition.simulatorRoutes = [simulatorRoute, ...snapshot.cognition.simulatorRoutes].slice(0, 12);
  }
  addTrace(snapshot, {
    role: 'worldModel',
    providerId: 'local',
    modelId: simulatorRoute.mcpServer,
    title: `Route simulator: ${simulatorRoute.domain}`,
    detail: simulatorRoute.reason,
    status: 'complete',
  });
  const prompt = `Objective:\n${request.objective}\n\nCompressed simulated state:\n${compressedState.summary}\n\nAffected variables:\n${compressedState.affectedVariables.join(', ')}\n\nProposed action:\n${step.action}\n\nSimulator route:\n${simulatorRoute.mcpServer} (${simulatorRoute.domain})\n\nAct only as an environment simulator. Predict direct consequences, side effects, confidence, and resulting new state. Return only JSON: {"predictedState":"","consequences":[""],"sideEffects":[""],"confidence":0.0}.`;
  const text = await maybeCallLiveModel(request, decision, getKey, snapshot, publish, `Simulate ${branch.title}`, `${step.action} via ${simulatorRoute.mcpServer}`, prompt, 1_200);
  const parsed = text ? parseJson<WorldPrediction>(text) : undefined;
  if (parsed?.predictedState) {
    return {
      predictedState: parsed.predictedState,
      consequences: ensureStringArray(parsed.consequences),
      sideEffects: ensureStringArray(parsed.sideEffects),
      confidence: clamp(Number(parsed.confidence ?? 0.72), 0.1, 0.99),
      simulatorRoute,
      compressedState,
    };
  }

  await sleep(180);
  return {
    ...fallbackPrediction(request, branch, step),
    simulatorRoute,
    compressedState,
  };
}

async function evaluateStep(
  request: HarnessRequest,
  route: RoutingDecision[],
  branch: BranchTrajectory,
  step: SimulatedStep,
  snapshot: HarnessRunSnapshot,
  getKey: GetKey,
  publish: () => void,
): Promise<StepEvaluation> {
  const decision = routeFor(route, 'evaluator');
  const prompt = `Target objective:\n${request.objective}\n\nConstraints:\n${request.constraints.join('\n')}\n\nPredicted state:\n${step.predictedState}\n\nConsequences:\n${step.consequences.join('\n')}\n\nSide effects:\n${step.sideEffects.join('\n')}\n\nScore this branch. Prune if it violates constraints, exceeds risk tolerance ${request.riskTolerance}, or drifts from the objective. If pruned, include a critique and a proposer heuristic patch. Return only JSON: {"score":0.0,"goalFit":0.0,"risk":0.0,"cost":0.0,"verdict":"continue|prune|commit","rationale":"","violations":[""],"critique":"","heuristicPatch":""}.`;
  const text = await maybeCallLiveModel(request, decision, getKey, snapshot, publish, `Evaluate ${branch.title}`, `Step ${step.index}: ${step.action}`, prompt, 1_000);
  const parsed = text ? parseJson<StepEvaluation>(text) : undefined;
  if (parsed?.verdict) {
    return {
      score: clamp(Number(parsed.score ?? 0.5), 0, 1),
      goalFit: clamp(Number(parsed.goalFit ?? 0.5), 0, 1),
      risk: clamp(Number(parsed.risk ?? 0.5), 0, 1),
      cost: clamp(Number(parsed.cost ?? 0.5), 0, 1),
      verdict: parsed.verdict,
      rationale: parsed.rationale ?? 'Evaluator returned no rationale.',
      violations: ensureStringArray(parsed.violations),
      critique: parsed.critique,
      heuristicPatch: parsed.heuristicPatch,
    };
  }

  await sleep(140);
  return fallbackEvaluation(request, branch, step);
}

async function synthesizeAnswer(
  request: HarnessRequest,
  route: RoutingDecision[],
  snapshot: HarnessRunSnapshot,
  winner: BranchTrajectory | undefined,
  getKey: GetKey,
  publish: () => void,
): Promise<string> {
  if (!winner) {
    return 'No branch cleared the evaluator. Tighten the objective, relax constraints, or add a stronger evaluator model key before committing actions.';
  }

  const decision = routeFor(route, 'synthesizer');
  const trajectory = winner.steps.map((step) => `${step.index}. ${step.action} -> ${step.evaluation?.rationale ?? 'accepted'}`).join('\n');
  const prompt = `Objective:\n${request.objective}\n\nWinning trajectory:\n${winner.title}\n${trajectory}\n\nWrite the final commit summary in terse operator language. Include the next executable action and any residual risks.`;
  const text = await maybeCallLiveModel(request, decision, getKey, snapshot, publish, 'Synthesize commit summary', winner.title, prompt, 900);

  if (text) {
    return text.trim();
  }

  await sleep(160);
  const acceptedSteps = winner.steps.map((step) => `${step.index}. ${step.action}`).join('\n');
  return `Committed trajectory: ${winner.title}\n\n${acceptedSteps}\n\nObjective fit: ${Math.round(winner.score * 100)}%. Peak risk: ${Math.round(winner.risk * 100)}%. Execute the first step, re-run the evaluator after any real-world state change, and keep the pruned branches as counterfactual evidence.`;
}

async function maybeCallLiveModel(
  request: HarnessRequest,
  decision: RoutingDecision,
  getKey: GetKey,
  snapshot: HarnessRunSnapshot,
  publish: () => void,
  title: string,
  detail: string,
  prompt: string,
  maxTokens: number,
): Promise<string | undefined> {
  snapshot.metrics.hiddenCalls += 1;
  snapshot.metrics.estimatedTokens += estimateTokens(prompt) + maxTokens;
  const trace = addTrace(snapshot, {
    role: decision.role,
    providerId: decision.providerId,
    modelId: decision.modelId,
    title,
    detail,
    status: 'running',
  });
  publish();

  const startedAt = Date.now();
  if (request.mode !== 'live' || decision.providerId === 'local') {
    trace.status = 'complete';
    trace.latencyMs = Date.now() - startedAt;
    publish();
    return undefined;
  }

  const apiKey = await getKey(decision.providerId);
  if (!apiKey) {
    trace.status = 'warning';
    trace.detail = `${decision.providerId} key missing. Falling back to local simulator.`;
    trace.latencyMs = Date.now() - startedAt;
    publish();
    return undefined;
  }

  try {
    const text = await callModel(decision, apiKey, systemPrompt(decision.role), prompt, maxTokens);
    trace.status = 'complete';
    trace.latencyMs = Date.now() - startedAt;
    trace.tokens = estimateTokens(prompt) + estimateTokens(text);
    publish();
    return text;
  } catch (error) {
    trace.status = 'warning';
    trace.detail = `${error instanceof Error ? error.message : String(error)} Falling back to local simulator.`;
    trace.latencyMs = Date.now() - startedAt;
    publish();
    return undefined;
  }
}

function systemPrompt(role: HarnessRole): string {
  if (role === 'proposer') {
    return 'You generate mutually exclusive candidate action plans. You do not solve the final task.';
  }
  if (role === 'worldModel') {
    return 'You are an impartial environment simulator. Predict direct consequences only. Do not optimize or solve.';
  }
  if (role === 'evaluator') {
    return 'You are a strict cost function. Score predicted states against objective fit, constraints, risk, and cost.';
  }
  return 'You are the commit node. Summarize the winning simulated trajectory into a concise final operator action.';
}

function normalizePlans(parsed: any[] | undefined, request: HarnessRequest): CandidatePlan[] {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.slice(0, request.branchFactor).map((plan, planIndex) => ({
    id: `branch-${planIndex + 1}`,
    title: String(plan.title ?? `Trajectory ${planIndex + 1}`),
    stance: String(plan.stance ?? 'Candidate trajectory'),
    steps: Array.isArray(plan.steps)
      ? plan.steps.slice(0, request.depth).map((step: any, stepIndex: number) => ({
          id: `branch-${planIndex + 1}-step-${stepIndex + 1}`,
          action: String(step.action ?? `Action ${stepIndex + 1}`),
          intent: String(step.intent ?? 'Advance the objective'),
          risk: normalizeRisk(step.risk),
        }))
      : [],
  })).filter((plan) => plan.steps.length > 0);
}

function fallbackPlans(request: HarnessRequest): CandidatePlan[] {
  const templates = [
    {
      title: 'Shortest Safe Commit',
      stance: 'Minimize moving parts and prove the objective with the smallest reversible action.',
      steps: [
        ['Define acceptance test', 'Convert the target into measurable end-state checks', 'low'],
        ['Build minimal execution path', 'Create the smallest viable action sequence', 'medium'],
        ['Simulate the highest-risk transition', 'Expose hidden state changes before committing', 'medium'],
        ['Commit the reversible subset', 'Execute only the branch that clears evaluation', 'low'],
      ],
    },
    {
      title: 'Adversarial Search',
      stance: 'Stress-test the objective before choosing the plan that survives hostile evaluation.',
      steps: [
        ['Enumerate failure modes', 'Find the ways this objective can go wrong', 'low'],
        ['Generate mutually exclusive branches', 'Force real strategic alternatives', 'medium'],
        ['Run consequence prediction', 'Project second-order effects for each branch', 'medium'],
        ['Prune unsafe branches', 'Kill paths that violate constraints or drift', 'high'],
      ],
    },
    {
      title: 'Cost-Optimized Cascade',
      stance: 'Use cheaper models for breadth, escalate only when uncertainty or risk justifies it.',
      steps: [
        ['Route roles by model strength', 'Assign proposer, simulator, evaluator, and synthesizer lanes', 'low'],
        ['Batch low-risk simulations', 'Explore cheap branches first', 'low'],
        ['Escalate uncertain nodes', 'Spend frontier calls only on high-leverage ambiguity', 'medium'],
        ['Memoize committed evidence', 'Preserve trace data for future runs', 'low'],
      ],
    },
    {
      title: 'World-Model First',
      stance: 'Model the environment before designing actions so the proposer cannot skip physics.',
      steps: [
        ['Map latent state variables', 'Identify what changes when actions happen', 'medium'],
        ['Predict transition constraints', 'Define what the environment will resist', 'medium'],
        ['Generate action policy', 'Choose actions compatible with predicted dynamics', 'low'],
        ['Evaluate residual risk', 'Quantify uncertainty before final synthesis', 'medium'],
      ],
    },
  ];

  return templates.slice(0, request.branchFactor).map((template, planIndex) => ({
    id: `branch-${planIndex + 1}`,
    title: template.title,
    stance: template.stance,
    steps: template.steps.slice(0, request.depth).map(([action, intent, risk], stepIndex) => ({
      id: `branch-${planIndex + 1}-step-${stepIndex + 1}`,
      action,
      intent,
      risk: risk as CandidateStep['risk'],
    })),
  }));
}

function fallbackPrediction(request: HarnessRequest, branch: BranchTrajectory, step: CandidateStep): WorldPrediction {
  const riskLanguage = step.risk === 'high' ? 'The action exposes a control point that must be guarded before execution.' : 'The action changes planning state without committing irreversible external effects.';
  return {
    predictedState: `${branch.currentState}\n\n[${branch.title} / ${step.action}] The harness now has more concrete evidence for "${request.objective}". The simulated state includes the intended effect: ${step.intent}.`,
    consequences: [
      `${step.action} makes the next decision more testable.`,
      'The state machine gains an auditable checkpoint for later replay.',
      riskLanguage,
    ],
    sideEffects: [
      step.risk === 'high' ? 'May require human approval before real-world execution.' : 'Adds modest latency but improves branch confidence.',
      'Consumes hidden planning calls proportional to branch depth.',
    ],
    confidence: step.risk === 'high' ? 0.64 : step.risk === 'medium' ? 0.74 : 0.84,
  };
}

function fallbackEvaluation(request: HarnessRequest, branch: BranchTrajectory, step: SimulatedStep): StepEvaluation {
  const riskPenalty = step.action.toLowerCase().includes('delete') || step.action.toLowerCase().includes('irreversible') ? 0.4 : 0;
  const intrinsicRisk = step.confidence < 0.7 ? 0.35 : 0.18;
  const risk = clamp(intrinsicRisk + riskPenalty + (branch.risk * 0.2), 0, 1);
  const constraintText = request.constraints.join(' ').toLowerCase();
  const violation = constraintText.includes('no production') && step.predictedState.toLowerCase().includes('production');
  const goalFit = clamp(0.62 + step.index * 0.07 + (step.consequences.length * 0.02), 0, 1);
  const cost = clamp(0.2 + request.branchFactor * request.depth * 0.025, 0, 1);
  const score = clamp(goalFit - risk * 0.28 - cost * 0.1, 0, 1);
  const shouldPrune = violation || risk > request.riskTolerance + 0.18 || score < 0.42;

  return {
    score,
    goalFit,
    risk,
    cost,
    verdict: shouldPrune ? 'prune' : step.index >= request.depth && score > 0.74 ? 'commit' : 'continue',
    rationale: shouldPrune
      ? 'Trajectory violates a constraint or exceeds configured risk tolerance.'
      : 'Trajectory improves objective fit while keeping risk inside the configured envelope.',
    violations: violation ? ['Predicted state conflicts with a production-safety constraint.'] : [],
    critique: shouldPrune
      ? `The proposer suggested "${step.action}" even though the predicted state raised risk ${Math.round(risk * 100)}% against tolerance ${Math.round(request.riskTolerance * 100)}%.`
      : undefined,
    heuristicPatch: shouldPrune
      ? `Before proposing "${step.action}", require a reversible checkpoint and explicit constraint check.`
      : undefined,
  };
}

function routeFor(route: RoutingDecision[], role: HarnessRole): RoutingDecision {
  const decision = route.find((item) => item.role === role);
  if (!decision) {
    throw new Error(`No routing decision for role: ${role}`);
  }
  return decision;
}

function addTrace(snapshot: HarnessRunSnapshot, entry: Omit<TraceEntry, 'id' | 'timestamp'>): TraceEntry {
  const trace: TraceEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  snapshot.trace = [trace, ...snapshot.trace].slice(0, 80);
  return trace;
}

function parseJson<T>(text: string): T | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf('{') >= 0 ? text.indexOf('{') : 0, text.lastIndexOf('}') >= 0 ? text.lastIndexOf('}') + 1 : text.length);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(text.slice(arrayStart, arrayEnd + 1)) as T;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean).slice(0, 5);
}

function normalizeRisk(value: unknown): CandidateStep['risk'] {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
