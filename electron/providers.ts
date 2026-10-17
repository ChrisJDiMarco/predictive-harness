import type {
  HarnessRequest,
  HarnessRole,
  ModelProfile,
  ProviderId,
  ProviderStatus,
  RoutingDecision,
} from '../src/shared/types';

interface ProviderDefinition {
  id: ProviderId;
  label: string;
  shortLabel: string;
  keyHint: string;
  baseUrl: string;
  models: ModelProfile[];
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    shortLabel: 'Claude',
    keyHint: 'sk-ant-...',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    models: [
      {
        providerId: 'anthropic',
        modelId: 'claude-opus-4-1-20250805',
        label: 'Claude Opus 4.1',
        tier: 'frontier',
        contextWindow: 200_000,
        capabilities: {
          reasoning: 0.98,
          simulation: 0.94,
          safety: 0.96,
          code: 0.9,
          creativity: 0.86,
          context: 0.92,
          latency: 0.48,
          cost: 0.35,
        },
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-20250514',
        label: 'Claude Sonnet 4',
        tier: 'balanced',
        contextWindow: 200_000,
        capabilities: {
          reasoning: 0.91,
          simulation: 0.9,
          safety: 0.94,
          code: 0.92,
          creativity: 0.82,
          context: 0.9,
          latency: 0.68,
          cost: 0.63,
        },
      },
      {
        providerId: 'anthropic',
        modelId: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku',
        tier: 'fast',
        contextWindow: 200_000,
        capabilities: {
          reasoning: 0.72,
          simulation: 0.72,
          safety: 0.86,
          code: 0.72,
          creativity: 0.7,
          context: 0.82,
          latency: 0.88,
          cost: 0.87,
        },
      },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    shortLabel: 'GPT',
    keyHint: 'sk-...',
    baseUrl: 'https://api.openai.com/v1/responses',
    models: [
      {
        providerId: 'openai',
        modelId: 'gpt-5.2',
        label: 'GPT-5.2',
        tier: 'frontier',
        contextWindow: 400_000,
        capabilities: {
          reasoning: 0.97,
          simulation: 0.91,
          safety: 0.9,
          code: 0.96,
          creativity: 0.87,
          context: 0.94,
          latency: 0.55,
          cost: 0.42,
        },
      },
      {
        providerId: 'openai',
        modelId: 'gpt-5-mini',
        label: 'GPT-5 Mini',
        tier: 'balanced',
        contextWindow: 400_000,
        capabilities: {
          reasoning: 0.86,
          simulation: 0.82,
          safety: 0.86,
          code: 0.88,
          creativity: 0.78,
          context: 0.9,
          latency: 0.78,
          cost: 0.78,
        },
      },
      {
        providerId: 'openai',
        modelId: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        tier: 'bulk',
        contextWindow: 128_000,
        capabilities: {
          reasoning: 0.68,
          simulation: 0.64,
          safety: 0.78,
          code: 0.68,
          creativity: 0.65,
          context: 0.72,
          latency: 0.95,
          cost: 0.96,
        },
      },
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    keyHint: 'AIza...',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        providerId: 'gemini',
        modelId: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        tier: 'frontier',
        contextWindow: 1_000_000,
        capabilities: {
          reasoning: 0.93,
          simulation: 0.94,
          safety: 0.87,
          code: 0.86,
          creativity: 0.84,
          context: 0.99,
          latency: 0.52,
          cost: 0.5,
        },
      },
      {
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        tier: 'fast',
        contextWindow: 1_000_000,
        capabilities: {
          reasoning: 0.82,
          simulation: 0.82,
          safety: 0.8,
          code: 0.78,
          creativity: 0.76,
          context: 0.96,
          latency: 0.9,
          cost: 0.9,
        },
      },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    keyHint: 'sk-...',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    models: [
      {
        providerId: 'deepseek',
        modelId: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        tier: 'balanced',
        contextWindow: 128_000,
        capabilities: {
          reasoning: 0.9,
          simulation: 0.82,
          safety: 0.72,
          code: 0.94,
          creativity: 0.73,
          context: 0.78,
          latency: 0.66,
          cost: 0.82,
        },
      },
      {
        providerId: 'deepseek',
        modelId: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        tier: 'bulk',
        contextWindow: 64_000,
        capabilities: {
          reasoning: 0.75,
          simulation: 0.68,
          safety: 0.68,
          code: 0.82,
          creativity: 0.65,
          context: 0.66,
          latency: 0.88,
          cost: 0.94,
        },
      },
    ],
  },
  {
    id: 'glm',
    label: 'Z.ai GLM',
    shortLabel: 'GLM',
    keyHint: 'glm-...',
    baseUrl: 'https://api.z.ai/api/paas/v4/chat/completions',
    models: [
      {
        providerId: 'glm',
        modelId: 'glm-5.1',
        label: 'GLM-5.1',
        tier: 'balanced',
        contextWindow: 128_000,
        capabilities: {
          reasoning: 0.86,
          simulation: 0.8,
          safety: 0.76,
          code: 0.8,
          creativity: 0.82,
          context: 0.76,
          latency: 0.68,
          cost: 0.78,
        },
      },
      {
        providerId: 'glm',
        modelId: 'glm-5-turbo',
        label: 'GLM-5 Turbo',
        tier: 'fast',
        contextWindow: 64_000,
        capabilities: {
          reasoning: 0.72,
          simulation: 0.68,
          safety: 0.7,
          code: 0.7,
          creativity: 0.72,
          context: 0.64,
          latency: 0.9,
          cost: 0.9,
        },
      },
    ],
  },
];

const ROLE_WEIGHTS: Record<HarnessRole, Partial<Record<keyof ModelProfile['capabilities'], number>>> = {
  proposer: {
    reasoning: 0.3,
    creativity: 0.24,
    context: 0.14,
    latency: 0.16,
    cost: 0.16,
  },
  worldModel: {
    reasoning: 0.32,
    simulation: 0.32,
    context: 0.18,
    code: 0.1,
    cost: 0.08,
  },
  evaluator: {
    safety: 0.32,
    reasoning: 0.28,
    simulation: 0.16,
    cost: 0.14,
    latency: 0.1,
  },
  synthesizer: {
    reasoning: 0.26,
    creativity: 0.2,
    context: 0.16,
    latency: 0.18,
    cost: 0.2,
  },
};

export function getProviderStatuses(hasKey: (providerId: ProviderId) => boolean, encryptedAt: (providerId: ProviderId) => string | undefined): ProviderStatus[] {
  return PROVIDERS.map((provider) => ({
    ...provider,
    hasKey: hasKey(provider.id),
    encryptedAt: encryptedAt(provider.id),
  }));
}

export function routeModels(request: HarnessRequest, statuses: ProviderStatus[]): RoutingDecision[] {
  const availableModels = statuses
    .filter((provider) => provider.hasKey)
    .flatMap((provider) => provider.models);

  if (request.mode === 'offline' || availableModels.length === 0) {
    return (['proposer', 'worldModel', 'evaluator', 'synthesizer'] as HarnessRole[]).map((role) => ({
      role,
      providerId: 'local',
      modelId: 'offline-simulator',
      label: 'Local Simulator',
      score: 0.72,
      reason: 'Using deterministic offline planning until live provider keys are available.',
    }));
  }

  const objective = request.objective.toLowerCase();
  const problemBoosts = {
    code: /code|api|database|typescript|python|repo|compile|bug|electron/.test(objective) ? 0.08 : 0,
    safety: /delete|payment|security|secret|production|irreversible|database/.test(objective) ? 0.08 : 0,
    context: request.currentState.length + request.objective.length > 4_000 ? 0.06 : 0,
  };

  return (['proposer', 'worldModel', 'evaluator', 'synthesizer'] as HarnessRole[]).map((role) => {
    const weights = ROLE_WEIGHTS[role];
    const ranked = availableModels
      .map((model) => {
        const weightedScore = Object.entries(weights).reduce((score, [key, weight]) => {
          const capability = model.capabilities[key as keyof ModelProfile['capabilities']];
          return score + capability * (weight ?? 0);
        }, 0);
        const budgetAdjustment = request.budgetMode === 'quality' ? model.capabilities.reasoning * 0.05 : model.capabilities.cost * 0.07;
        const riskAdjustment = role === 'evaluator' ? request.riskTolerance * model.capabilities.safety * 0.04 : 0;
        const score = weightedScore + budgetAdjustment + riskAdjustment + problemBoosts.code * model.capabilities.code + problemBoosts.safety * model.capabilities.safety + problemBoosts.context * model.capabilities.context;
        return { model, score };
      })
      .sort((a, b) => b.score - a.score);

    const choice = ranked[0];
    return {
      role,
      providerId: choice.model.providerId,
      modelId: choice.model.modelId,
      label: choice.model.label,
      score: Number(choice.score.toFixed(3)),
      reason: buildRoutingReason(role, choice.model, request),
    };
  });
}

function buildRoutingReason(role: HarnessRole, model: ModelProfile, request: HarnessRequest): string {
  if (role === 'proposer') {
    return `${model.label} has the best blend of reasoning and divergent-plan generation for ${request.budgetMode} mode.`;
  }
  if (role === 'worldModel') {
    return `${model.label} was selected for state prediction, long context, and simulation strength.`;
  }
  if (role === 'evaluator') {
    return `${model.label} is assigned to cost/risk checks because its safety and reasoning scores are strongest in the configured pool.`;
  }
  return `${model.label} will synthesize the committed trajectory into the final operator-facing result.`;
}

export async function callModel(
  decision: RoutingDecision,
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens = 1_200,
): Promise<string> {
  if (decision.providerId === 'local') {
    throw new Error('Local simulator does not make network calls.');
  }

  if (decision.providerId === 'anthropic') {
    return callAnthropic(decision.modelId, apiKey, system, prompt, maxTokens);
  }

  if (decision.providerId === 'openai') {
    return callOpenAi(decision.modelId, apiKey, system, prompt, maxTokens);
  }

  if (decision.providerId === 'gemini') {
    return callGemini(decision.modelId, apiKey, system, prompt, maxTokens);
  }

  if (decision.providerId === 'deepseek') {
    return callChatCompletions('https://api.deepseek.com/chat/completions', decision.modelId, apiKey, system, prompt, maxTokens);
  }

  return callChatCompletions('https://api.z.ai/api/paas/v4/chat/completions', decision.modelId, apiKey, system, prompt, maxTokens);
}

async function callAnthropic(model: string, apiKey: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await readJsonResponse(response);
  return data.content?.map((part: { text?: string }) => part.text ?? '').join('\n').trim() ?? '';
}

async function callOpenAi(model: string, apiKey: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: system,
      input: prompt,
      max_output_tokens: maxTokens,
    }),
  });
  const data = await readJsonResponse(response);
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  return data.output
    ?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? [])
    .map((content: { text?: string }) => content.text ?? '')
    .join('\n')
    .trim() ?? '';
}

async function callGemini(model: string, apiKey: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });
  const data = await readJsonResponse(response);
  return data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('\n').trim() ?? '';
}

async function callChatCompletions(url: string, model: string, apiKey: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      stream: false,
    }),
  });
  const data = await readJsonResponse(response);
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data.error?.message ?? data.message ?? response.statusText;
    throw new Error(`Provider request failed (${response.status}): ${message}`);
  }

  return data;
}
