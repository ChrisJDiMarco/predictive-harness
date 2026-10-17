import type { HarnessRole, ProviderId } from '../shared/types';

export const ROLE_LABELS: Record<HarnessRole, string> = {
  proposer: 'Proposer',
  worldModel: 'World Model',
  evaluator: 'Evaluator',
  synthesizer: 'Synthesizer',
};

export const PROVIDER_ACCENTS: Record<ProviderId | 'local', string> = {
  anthropic: '#f0784f',
  openai: '#50c878',
  gemini: '#58a6ff',
  deepseek: '#f2b84b',
  glm: '#df6fff',
  local: '#8b949e',
};

export function compactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(value);
}

export function formatElapsed(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  return `${(ms / 1_000).toFixed(1)}s`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
