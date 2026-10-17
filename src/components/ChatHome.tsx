import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  KeyRound,
  Mic,
  PanelRight,
  Send,
  Settings,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HarnessRunSnapshot, ProviderStatus } from '../shared/types';
import JarvisCore from './JarvisCore';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

interface ChatHomeProps {
  providers: ProviderStatus[];
  snapshot: HarnessRunSnapshot | null;
  isRunning: boolean;
  onOpenHarness: () => void;
  onOpenSettings: () => void;
  onSubmitObjective: (objective: string) => Promise<void>;
}

export default function ChatHome({
  snapshot,
  isRunning,
  onOpenHarness,
  onOpenSettings,
  onSubmitObjective,
}: ChatHomeProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'I’m online. Give me an objective and I’ll route it through the simulator.',
    },
  ]);
  const recognitionRef = useRef<any>(null);
  const announcedRunRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const voiceAvailable = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }, []);

  const hiddenCalls = snapshot?.metrics.hiddenCalls ?? 0;
  const prunedBranches = snapshot?.metrics.prunedBranches ?? 0;
  const routeCount = snapshot?.cognition?.simulatorRoutes.length ?? 0;
  const coreIntensity = Math.min(1, hiddenCalls / 30 + prunedBranches / 12 + routeCount / 18 + (isRunning ? 0.18 : 0));

  useEffect(() => {
    if (snapshot?.status !== 'complete' || !snapshot.finalAnswer || announcedRunRef.current === snapshot.runId) {
      return;
    }

    announcedRunRef.current = snapshot.runId;
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${snapshot.runId}`,
        role: 'assistant',
        content: snapshot.finalAnswer ?? '',
      },
    ]);

    if (autoSpeak) {
      speak(snapshot.finalAnswer);
    }
  }, [autoSpeak, snapshot]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function submit() {
    const objective = input.trim();
    if (!objective || isRunning) {
      return;
    }

    setInput('');
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', content: objective },
      {
        id: `assistant-routing-${Date.now()}`,
        role: 'assistant',
        content: 'Routing through proposer, world model, evaluator, and synthesizer.',
      },
    ]);
    await onSubmitObjective(objective);
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop?.();
      setIsListening(false);
      return;
    }

    if (!voiceAvailable) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-voice-${Date.now()}`,
          role: 'assistant',
          content: 'Voice capture is not available in this Electron runtime yet.',
        },
      ]);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setInput(transcript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function speak(text: string) {
    if (!window.speechSynthesis || !text.trim()) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 700));
    utterance.rate = 0.96;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <main className={`chat-shell jarvis-command-shell ${isRunning ? 'is-running' : ''} ${isListening ? 'is-listening' : ''}`}>
      <JarvisCore isRunning={isRunning} isListening={isListening} intensity={coreIntensity} />
      <div className="jarvis-grid" />
      <div className="jarvis-vignette" />

      <header className="chat-topbar jarvis-topbar">
        <div className="chat-brand jarvis-brand">
          <div className="brand-mark chat-brand-mark jarvis-brand-mark">
            <BrainCircuit size={22} />
          </div>
          <div>
            <strong>JARVIS Core</strong>
            <span>Predictive Harness</span>
          </div>
        </div>
        <div className="chat-top-actions">
          <button className="chat-icon-button" type="button" onClick={onOpenSettings} aria-label="Keys and models">
            <Settings size={17} />
          </button>
          <button className="lab-jump-button" type="button" onClick={onOpenHarness}>
            <PanelRight size={17} />
            Harness Lab
            <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      <section className="jarvis-layout jarvis-clean-layout">
        <section className="jarvis-center jarvis-clean-center">
          <div className="jarvis-core-caption">
            <span className="core-state"><i />{isListening ? 'voice channel open' : isRunning ? 'simulation in progress' : 'objective channel ready'}</span>
            <strong>{snapshot?.objective ?? 'Awaiting command objective'}</strong>
          </div>

          <div className="core-readout" aria-hidden="true">
            <span>PH / CORE</span>
            <span>{isRunning ? 'LIVE' : 'STANDBY'}</span>
            <span>{String(hiddenCalls).padStart(2, '0')} CALLS</span>
          </div>

          <div className="jarvis-comms-panel">
            <div className="comms-header">
              <div><i /> Command channel</div>
              <span>Return to send · Shift + Return for line break</span>
            </div>
            <div className="message-stream jarvis-message-stream">
              {messages.map((message) => (
                <article className={`chat-message ${message.role}`} key={message.id}>
                  <span>{message.role === 'assistant' ? <Sparkles size={15} /> : <KeyRound size={15} />}</span>
                  <p>{message.content}</p>
                </article>
              ))}
              {isRunning ? (
                <article className="chat-message assistant thinking">
                  <span>
                    <Activity size={15} />
                  </span>
                  <p>Simulating trajectories…</p>
                </article>
              ) : null}
            </div>

            <div className="chat-composer jarvis-composer">
              <textarea
                ref={inputRef}
                value={input}
                placeholder="Type or speak an objective"
                aria-label="Objective command"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
              />
              <div className="composer-actions">
                <button className={`round-action ${isListening ? 'hot' : ''}`} type="button" onClick={toggleListening} aria-label="Voice input">
                  {isListening ? <Square size={18} /> : <Mic size={18} />}
                </button>
                <button className={`round-action ${autoSpeak ? 'active' : ''}`} type="button" onClick={() => setAutoSpeak((current) => !current)} aria-label="Spoken output">
                  {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button className="send-action" type="button" onClick={submit} disabled={!input.trim() || isRunning} aria-label="Send">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
