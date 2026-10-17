# Predictive Harness

Electron app for objective-driven, simulation-based agent orchestration.

## What It Does

- Stores Anthropic, OpenAI, Gemini, DeepSeek, and GLM API keys in the Electron main process.
- Routes four functional nodes: Proposer, World Model, Evaluator, and Synthesizer.
- Runs an observable planning loop with candidate branches, state prediction, pruning, and final commit synthesis.
- Falls back to a deterministic local simulator when keys are missing or live calls fail.
- Exposes hidden-call count, pruning count, token estimate, route decisions, and trace events in the UI.

## Run

```bash
npm install
npm run dev
```

For a production-style smoke test:

```bash
npm run build
npx electron .
```

## Live Model Calls

Open **Keys and Models**, add provider keys, switch **Mode** to **Live**, and run the harness. Keys are encrypted with Electron `safeStorage` when available and are never exposed to the renderer.
