import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  Gauge,
  GitBranch,
  KeyRound,
  Layers3,
  Lock,
  Play,
  Radar,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import ChatHome from './components/ChatHome';
import type {
  BranchTrajectory,
  HarnessRequest,
  HarnessRunSnapshot,
  ProviderId,
  ProviderStatus,
  RoutingDecision,
  TraceEntry,
} from './shared/types';
import { getHarnessApi } from './lib/fallbackHarness';
import { compactNumber, formatElapsed, percent, PROVIDER_ACCENTS, ROLE_LABELS } from './lib/format';

const INITIAL_REQUEST: HarnessRequest = {
  objective:
    'Design a production-grade objective-driven agent harness that proposes candidate plans, predicts consequences, evaluates cost/risk, prunes weak branches, and commits the safest trajectory.',
  currentState:
    'A clean Electron project exists. The system needs a polished operator interface, secure API key handling, a multi-provider model router, and an observable simulation loop.',
  constraints: [
    'Never expose API keys to the renderer',
    'Prune branches that exceed configured risk',
    'Prefer reversible actions before commit',
    'Keep hidden calls observable',
  ],
  mode: 'offline',
  branchFactor: 3,
  depth: 3,
  riskTolerance: 0.58,
  budgetMode: 'balanced',
};

const FALLBACK_TRACE: TraceEntry[] = [
  {
    id: 'trace-ready',
    timestamp: new Date().toISOString(),
    role: 'orchestrator',
    providerId: 'local',
    modelId: 'state-machine',
    title: 'Harness ready',
    detail: 'Configure keys or run the local simulator.',
    status: 'complete',
  },
];

export default function App() {
  const [view, setView] = useState<'chat' | 'harness'>('chat');
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [request, setRequest] = useState<HarnessRequest>(INITIAL_REQUEST);
  const [constraintDraft, setConstraintDraft] = useState('');
  const [snapshot, setSnapshot] = useState<HarnessRunSnapshot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const harnessApi = useMemo(() => getHarnessApi(), []);

  useEffect(() => {
    void loadProviders();
    return () => unsubscribeRef.current?.();
  }, []);

  const configuredProviders = providers.filter((provider) => provider.hasKey);
  const selectedBranch = useMemo(() => {
    const winner = snapshot?.branches.find((branch) => branch.status === 'winner');
    return winner ?? snapshot?.branches[0];
  }, [snapshot]);

  const route = snapshot?.route ?? [];
  const trace = snapshot?.trace.length ? snapshot.trace : FALLBACK_TRACE;

  async function loadProviders() {
    const nextProviders = await harnessApi.getProviders();
    setProviders(nextProviders);
  }

  async function runHarness(requestOverride?: HarnessRequest) {
    unsubscribeRef.current?.();
    const runRequest = requestOverride ?? request;
    if (requestOverride) {
      setRequest(requestOverride);
    }
    setIsRunning(true);
    const runId = await harnessApi.startRun(runRequest);
    unsubscribeRef.current = harnessApi.onRunEvent(runId, (event) => {
      setSnapshot(event.snapshot);
      if (event.type === 'done' || event.type === 'error') {
        setIsRunning(false);
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      }
    });
  }

  async function submitChatObjective(objective: string) {
    const nextRequest: HarnessRequest = {
      ...request,
      objective,
      currentState:
        'The operator submitted this objective from the voice/text command surface. Convert the request into candidate trajectories, simulate consequences, prune unsafe branches, and synthesize the best next action.',
    };
    await runHarness(nextRequest);
  }

  function updateRequest(patch: Partial<HarnessRequest>) {
    setRequest((current) => ({ ...current, ...patch }));
  }

  function addConstraint() {
    const trimmed = constraintDraft.trim();
    if (!trimmed) {
      return;
    }
    updateRequest({ constraints: [...request.constraints, trimmed] });
    setConstraintDraft('');
  }

  function removeConstraint(index: number) {
    updateRequest({ constraints: request.constraints.filter((_, currentIndex) => currentIndex !== index) });
  }

  if (view === 'chat') {
    return (
      <>
        <ChatHome
          providers={providers}
          snapshot={snapshot}
          isRunning={isRunning}
          onOpenHarness={() => setView('harness')}
          onOpenSettings={() => setSettingsOpen(true)}
          onSubmitObjective={submitChatObjective}
        />
        {settingsOpen ? (
          <ProviderSettings
            providers={providers}
            onClose={() => setSettingsOpen(false)}
            onSave={async (providerId, apiKey) => {
              const next = await harnessApi.saveProviderKey(providerId, apiKey);
              setProviders(next);
            }}
            onClear={async (providerId) => {
              const next = await harnessApi.clearProviderKey(providerId);
              setProviders(next);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <BrainCircuit size={22} />
          </div>
          <div>
            <strong>Predictive Harness</strong>
            <span>Objective-driven runtime</span>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Workspace">
          <button className="rail-item" type="button" onClick={() => setView('chat')}>
            <Sparkles size={18} />
            Chat
          </button>
          <button className="rail-item active" type="button">
            <Radar size={18} />
            Lab
          </button>
          <button className="rail-item" type="button">
            <Route size={18} />
            Routes
          </button>
          <button className="rail-item" type="button">
            <Activity size={18} />
            Trace
          </button>
          <button className="rail-item" type="button">
            <ShieldCheck size={18} />
            Policy
          </button>
        </nav>

        <div className="provider-stack">
          <div className="sidebar-label">Provider Mesh</div>
          {providers.map((provider) => (
            <div className="provider-pill" key={provider.id}>
              <span className="provider-dot" style={{ background: PROVIDER_ACCENTS[provider.id] }} />
              <span>{provider.shortLabel}</span>
              {provider.hasKey ? <Check size={14} /> : <Lock size={13} />}
            </div>
          ))}
        </div>

        <button className="settings-button" type="button" onClick={() => setSettingsOpen(true)}>
          <Settings size={17} />
          Keys and Models
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Simulation-Based Planning Architecture</p>
            <h1>Agentic harness command surface</h1>
          </div>
          <div className="topbar-actions">
            <div className="status-strip">
              <StatusPill icon={<KeyRound size={14} />} label={`${configuredProviders.length}/${providers.length || 5} keys`} />
              <StatusPill icon={<GitBranch size={14} />} label={`${request.branchFactor} branches`} />
              <StatusPill icon={<Gauge size={14} />} label={`${request.depth} depth`} />
            </div>
            <button className="primary-action" type="button" onClick={() => runHarness()} disabled={isRunning}>
              {isRunning ? <Activity size={17} /> : <Play size={17} />}
              {isRunning ? 'Running' : 'Run Harness'}
            </button>
            <button className="secondary-action" type="button" onClick={() => setView('chat')}>
              Chat
            </button>
          </div>
        </header>

        <section className="dashboard-grid">
          <section className="panel objective-panel">
            <PanelHeader icon={<Sparkles size={18} />} title="Objective" meta={request.mode === 'live' ? 'Live calls' : 'Local simulator'} />

            <label className="field-label" htmlFor="objective">
              Target state
            </label>
            <textarea
              id="objective"
              className="text-input objective-input"
              value={request.objective}
              onChange={(event) => updateRequest({ objective: event.target.value })}
            />

            <label className="field-label" htmlFor="state">
              Current state
            </label>
            <textarea
              id="state"
              className="text-input state-input"
              value={request.currentState}
              onChange={(event) => updateRequest({ currentState: event.target.value })}
            />

            <div className="constraint-row">
              <span className="field-label">Constraints</span>
              <div className="constraint-list">
                {request.constraints.map((constraint, index) => (
                  <button className="constraint-chip" key={`${constraint}-${index}`} type="button" onClick={() => removeConstraint(index)}>
                    {constraint}
                    <Trash2 size={12} />
                  </button>
                ))}
              </div>
              <div className="constraint-input-row">
                <input
                  className="line-input"
                  value={constraintDraft}
                  onChange={(event) => setConstraintDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addConstraint();
                    }
                  }}
                  placeholder="Add constraint"
                />
                <button className="secondary-action" type="button" onClick={addConstraint}>
                  Add
                </button>
              </div>
            </div>

            <div className="control-grid">
              <SegmentedControl
                label="Mode"
                value={request.mode}
                options={[
                  { label: 'Offline', value: 'offline' },
                  { label: 'Live', value: 'live' },
                ]}
                onChange={(value) => updateRequest({ mode: value as HarnessRequest['mode'] })}
              />
              <SegmentedControl
                label="Budget"
                value={request.budgetMode}
                options={[
                  { label: 'Quality', value: 'quality' },
                  { label: 'Balanced', value: 'balanced' },
                  { label: 'Economy', value: 'economy' },
                ]}
                onChange={(value) => updateRequest({ budgetMode: value as HarnessRequest['budgetMode'] })}
              />
              <RangeControl label="Branches" min={2} max={4} step={1} value={request.branchFactor} onChange={(value) => updateRequest({ branchFactor: value })} />
              <RangeControl label="Depth" min={2} max={4} step={1} value={request.depth} onChange={(value) => updateRequest({ depth: value })} />
              <RangeControl
                label="Risk tolerance"
                min={0.25}
                max={0.9}
                step={0.01}
                value={request.riskTolerance}
                format={(value) => percent(value)}
                onChange={(value) => updateRequest({ riskTolerance: value })}
              />
            </div>
          </section>

          <section className="panel central-panel">
            <PanelHeader icon={<Layers3 size={18} />} title="Search Tree" meta={snapshot?.status ?? 'idle'} />
            <ModelRoute route={route} providers={providers} />
            <BranchMap branches={snapshot?.branches ?? []} selectedBranch={selectedBranch} />
            <CommitPanel snapshot={snapshot} selectedBranch={selectedBranch} />
          </section>

          <aside className="right-column">
            <section className="panel metrics-panel">
              <PanelHeader icon={<Zap size={18} />} title="Run Telemetry" meta={snapshot ? formatElapsed(snapshot.metrics.elapsedMs) : 'ready'} />
              <div className="metric-grid">
                <Metric label="Hidden calls" value={snapshot?.metrics.hiddenCalls ?? 0} />
                <Metric label="Pruned" value={snapshot?.metrics.prunedBranches ?? 0} />
                <Metric label="Est. tokens" value={compactNumber(snapshot?.metrics.estimatedTokens ?? 0)} />
                <Metric label="Memory hits" value={snapshot?.cognition?.memoryHits.length ?? 0} />
                <Metric label="Token saved" value={compactNumber(snapshot?.cognition?.compressionSavings ?? 0)} />
                <Metric label="Rules" value={snapshot?.cognition?.learnedHeuristics.length ?? 0} />
              </div>
            </section>

            <section className="panel provider-panel">
              <PanelHeader icon={<CircleDot size={18} />} title="Model Mesh" meta={`${providers.length || 5} providers`} />
              <ProviderMatrix providers={providers} />
            </section>

            <section className="panel trace-panel">
              <PanelHeader icon={<Activity size={18} />} title="Trace Bus" meta={`${trace.length} events`} />
              <TraceList trace={trace} />
            </section>
          </aside>
        </section>
      </main>

      {settingsOpen ? (
        <ProviderSettings
          providers={providers}
          onClose={() => setSettingsOpen(false)}
          onSave={async (providerId, apiKey) => {
            const next = await harnessApi.saveProviderKey(providerId, apiKey);
            setProviders(next);
          }}
          onClear={async (providerId) => {
            const next = await harnessApi.clearProviderKey(providerId);
            setProviders(next);
          }}
        />
      ) : null}
    </div>
  );
}

function StatusPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="status-pill">
      {icon}
      {label}
    </span>
  );
}

function PanelHeader({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="panel-header">
      <div>
        {icon}
        <h2>{title}</h2>
      </div>
      <span>{meta}</span>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="control-block">
      <span className="field-label">{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button className={option.value === value ? 'selected' : ''} type="button" key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  format = String,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control-block range-block">
      <span className="field-label">
        {label}
        <strong>{format(value)}</strong>
      </span>
      <input min={min} max={max} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ModelRoute({ route, providers }: { route: RoutingDecision[]; providers: ProviderStatus[] }) {
  const displayRoute =
    route.length > 0
      ? route
      : (['proposer', 'worldModel', 'evaluator', 'synthesizer'] as const).map((role) => ({
          role,
          providerId: 'local' as const,
          modelId: 'pending-route',
          label: 'Awaiting run',
          score: 0,
          reason: 'Run the harness to assign this node.',
        }));

  return (
    <div className="route-lanes">
      {displayRoute.map((decision) => {
        const provider = providers.find((item) => item.id === decision.providerId);
        return (
          <div className="route-lane" key={decision.role}>
            <div className="lane-topline">
              <span style={{ background: PROVIDER_ACCENTS[decision.providerId] }} />
              {ROLE_LABELS[decision.role]}
            </div>
            <strong>{decision.label}</strong>
            <small>{provider?.label ?? 'Local Simulator'}</small>
          </div>
        );
      })}
    </div>
  );
}

function BranchMap({ branches, selectedBranch }: { branches: BranchTrajectory[]; selectedBranch?: BranchTrajectory }) {
  if (branches.length === 0) {
    return (
      <div className="empty-tree">
        <GitBranch size={28} />
        <span>No trajectories yet</span>
      </div>
    );
  }

  return (
    <div className="branch-map">
      {branches.map((branch) => (
        <article className={`branch-card ${branch.status}`} key={branch.id}>
          <div className="branch-card-header">
            <div>
              <strong>{branch.title}</strong>
              <span>{branch.stance}</span>
            </div>
            <b>{percent(branch.score)}</b>
          </div>
          <div className="branch-steps">
            {branch.steps.map((step) => (
              <div className="step-node" key={step.id}>
                <span>{step.index}</span>
                <p>{step.action}</p>
                <small>{step.evaluation ? step.evaluation.verdict : 'simulating'}</small>
              </div>
            ))}
          </div>
        </article>
      ))}
      {selectedBranch ? (
        <div className="selected-trajectory">
          <div className="selected-title">
            <ChevronRight size={16} />
            <strong>{selectedBranch.title}</strong>
          </div>
          <p>{selectedBranch.currentState}</p>
        </div>
      ) : null}
    </div>
  );
}

function CommitPanel({ snapshot, selectedBranch }: { snapshot: HarnessRunSnapshot | null; selectedBranch?: BranchTrajectory }) {
  return (
    <div className="commit-panel">
      <div>
        <span className="field-label">Commit candidate</span>
        <strong>{selectedBranch?.title ?? 'No branch selected'}</strong>
      </div>
      <div className="commit-score">
        <span>Score</span>
        <b>{selectedBranch ? percent(selectedBranch.score) : '0%'}</b>
      </div>
      <pre>{snapshot?.finalAnswer ?? 'Final synthesis appears here after the evaluator clears a trajectory.'}</pre>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProviderMatrix({ providers }: { providers: ProviderStatus[] }) {
  return (
    <div className="provider-matrix">
      {providers.map((provider) => (
        <div className="provider-row" key={provider.id}>
          <div>
            <span className="provider-dot" style={{ background: PROVIDER_ACCENTS[provider.id] }} />
            <strong>{provider.shortLabel}</strong>
          </div>
          <span className={provider.hasKey ? 'key-ready' : 'key-missing'}>{provider.hasKey ? 'Ready' : 'No key'}</span>
        </div>
      ))}
    </div>
  );
}

function TraceList({ trace }: { trace: TraceEntry[] }) {
  return (
    <div className="trace-list">
      {trace.map((entry) => (
        <div className={`trace-row ${entry.status}`} key={entry.id}>
          <span className="trace-dot" style={{ background: PROVIDER_ACCENTS[entry.providerId] }} />
          <div>
            <strong>{entry.title}</strong>
            <p>{entry.detail}</p>
            <small>
              {entry.modelId}
              {entry.latencyMs ? ` · ${formatElapsed(entry.latencyMs)}` : ''}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProviderSettings({
  providers,
  onClose,
  onSave,
  onClear,
}: {
  providers: ProviderStatus[];
  onClose: () => void;
  onSave: (providerId: ProviderId, apiKey: string) => Promise<void>;
  onClear: (providerId: ProviderId) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function save(providerId: ProviderId) {
    setSaving(providerId);
    await onSave(providerId, drafts[providerId] ?? '');
    setDrafts((current) => ({ ...current, [providerId]: '' }));
    setSaving(null);
  }

  async function clear(providerId: ProviderId) {
    setSaving(providerId);
    await onClear(providerId);
    setSaving(null);
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="settings-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="eyebrow">Provider credentials</p>
            <h2>Keys and model lanes</h2>
          </div>
          <button className="secondary-action" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settings-list">
          {providers.map((provider) => (
            <section className="settings-provider" key={provider.id}>
              <div className="settings-provider-header">
                <div>
                  <span className="provider-dot" style={{ background: PROVIDER_ACCENTS[provider.id] }} />
                  <strong>{provider.label}</strong>
                </div>
                <span className={provider.hasKey ? 'key-ready' : 'key-missing'}>{provider.hasKey ? 'Stored' : 'Missing'}</span>
              </div>
              <div className="key-entry-row">
                <input
                  className="line-input"
                  type="password"
                  value={drafts[provider.id] ?? ''}
                  placeholder={provider.keyHint}
                  onChange={(event) => setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))}
                />
                <button className="secondary-action" type="button" disabled={saving === provider.id} onClick={() => save(provider.id)}>
                  Save
                </button>
                <button className="icon-action" type="button" disabled={saving === provider.id || !provider.hasKey} onClick={() => clear(provider.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="model-list">
                {provider.models.map((model) => (
                  <span key={model.modelId}>
                    {model.label}
                    <small>{compactNumber(model.contextWindow)} ctx</small>
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
