'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { uiString } from '@/shared/i18n';
import type { Locale } from '@/shared/schemas';
import styles from './GameShell.module.css';

type Message = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
};

type Session = {
  sessionId: string;
  revision: number;
  locale: Locale;
  status: string;
  savedAt: string;
  world: { title: string };
  party: Array<{
    playerId: string;
    displayName: string;
    characterName: string;
    role: string;
    hp: number;
    mp: number;
    maxHp: number;
    maxMp: number;
    active: boolean;
    ability: { name: string; cost: number };
  }>;
  turn: { activePlayerId: string; round: number };
  scene: { title: string; location: string; description: string; index: number; progress: number; threat: number; progressTarget: number; threatLimit: number };
  objective: { text: string };
  inventory: Array<{ name: string; quantity: number }>;
  suggestions: Array<{ text: string; approachId: string | null }>;
  recentMessages: Message[];
  pendingOperation: {
    id: string;
    phase: string;
    canRetry: boolean;
    canCancel: boolean;
    preview: {
      actionText: string;
      attribute: string;
      target: number;
      total?: number;
      stakes: { success: string; partial: string; failure: string };
      mpCost: number;
    } | null;
    errorCode: string | null;
  } | null;
  ending: { kind: string; summary: string; epilogues: Array<{ playerId: string; text: string }> } | null;
};

type ActionResponse = { session: Session; operation?: Session['pendingOperation'] };

export function GameShell() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [text, setText] = useState('');
  const [useAbility, setUseAbility] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locale: Locale = session?.locale ?? 'en';
  const t = (key: Parameters<typeof uiString>[1], vars?: Record<string, string>) =>
    uiString(locale, key, vars);

  useEffect(() => {
    let cancelled = false;
    // Initial fetch of the saved session; updates land in the promise callback.
    void api<{ session: Session | null }>('/api/session')
      .then((data) => {
        if (cancelled) return;
        if (!data.session) {
          router.replace('/');
          return;
        }
        setSession(data.session);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const pending = session?.pendingOperation;
    if (!pending || !['interpreting', 'resolving', 'narrating'].includes(pending.phase)) {
      return;
    }
    const timer = window.setInterval(() => {
      void api<ActionResponse>(`/api/actions/${pending.id}`).then((data) => {
        setSession(data.session);
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [session?.pendingOperation]);

  async function send(kind: 'act' | 'ask' | 'pass') {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        kind === 'pass'
          ? {
              operationId: crypto.randomUUID(),
              expectedRevision: session.revision,
              actorId: session.turn.activePlayerId,
              kind,
            }
          : {
              operationId: crypto.randomUUID(),
              expectedRevision: session.revision,
              actorId: session.turn.activePlayerId,
              kind,
              text,
              ...(kind === 'act' ? { useAbility } : {}),
            };
      const result = await api<ActionResponse>('/api/actions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(result.session);
      if (kind !== 'act' || result.session.pendingOperation?.phase !== 'awaiting_confirmation') {
        setText('');
        setUseAbility(false);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(path: 'confirm' | 'cancel' | 'retry') {
    if (!session?.pendingOperation) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<ActionResponse>(
        `/api/actions/${session.pendingOperation.id}/${path}`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: session.revision }),
        },
      );
      setSession(result.session);
      if (path !== 'cancel') {
        setText('');
        setUseAbility(false);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <p className={styles.loading}>{t('ui.saved')}…</p>;
  }

  const active = session.party.find((member) => member.playerId === session.turn.activePlayerId);
  const preview = session.pendingOperation?.preview;

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <strong>{session.world.title}</strong>
        <span>
          {t('ui.saved')} · {new Date(session.savedAt).toLocaleString()}
        </span>
      </header>
      <aside className={styles.party}>
        {session.party.map((member) => (
          <article key={member.playerId} className={member.active ? styles.active : undefined}>
            <h2>
              {member.displayName} · {member.characterName}
            </h2>
            <p>{member.role}</p>
            <p>
              HP {member.hp}/{member.maxHp} · MP {member.mp}/{member.maxMp}
            </p>
          </article>
        ))}
      </aside>
      <main className={styles.story}>
        <p className={styles.place}>
          {session.scene.location} · {session.scene.title}
        </p>
        {session.recentMessages.map((message) => (
          <MessageBlock key={message.id} message={message} />
        ))}
        {session.ending ? (
          <section className={styles.ending}>
            <h2>{t('ui.ending')}: {session.ending.kind}</h2>
            <p>{session.ending.summary}</p>
            {session.ending.epilogues.map((epilogue) => (
              <p key={epilogue.playerId}>{epilogue.text}</p>
            ))}
            <button type="button" onClick={() => router.push('/')}>
              {t('ui.newGame')}
            </button>
          </section>
        ) : null}
      </main>
      <aside className={styles.side}>
        <section>
          <h2>{t('ui.objective')}</h2>
          <p>{session.objective.text}</p>
          <p>
            {session.scene.progress}/{session.scene.progressTarget} · {session.scene.threat}/
            {session.scene.threatLimit}
          </p>
        </section>
        <section>
          <h2>{t('ui.inventory')}</h2>
          <ul>
            {session.inventory.map((item) => (
              <li key={item.name}>
                {item.name} × {item.quantity}
              </li>
            ))}
          </ul>
        </section>
      </aside>
      {session.status === 'active' ? (
        <footer className={styles.composer}>
          <p>{t('ui.turn', { name: active?.displayName ?? '' })}</p>
          {preview ? (
            <div className={styles.preview}>
              <h3>{t('ui.preview')}</h3>
              <p>{preview.actionText}</p>
              <p>
                {preview.attribute} DC {preview.target} · MP {preview.mpCost}
              </p>
              <p>{preview.stakes.success}</p>
              <p>{preview.stakes.partial}</p>
              <p>{preview.stakes.failure}</p>
              <button type="button" disabled={busy} onClick={() => void confirm('confirm')}>
                {t('ui.confirm')}
              </button>
              {session.pendingOperation?.canCancel ? (
                <button type="button" disabled={busy} onClick={() => void confirm('cancel')}>
                  {t('ui.cancel')}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.suggestions}>
                {session.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    type="button"
                    onClick={() => setText(suggestion.text)}
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
              <textarea
                value={text}
                maxLength={600}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('ui.composerHint')}
              />
              <label>
                <input
                  type="checkbox"
                  checked={useAbility}
                  onChange={(event) => setUseAbility(event.target.checked)}
                />
                {t('ui.ability')}
                {active ? ` · ${active.ability.name} (${active.ability.cost} MP)` : ''}
              </label>
              <div className={styles.row}>
                <button type="button" disabled={busy || !text.trim()} onClick={() => void send('act')}>
                  {t('ui.act')}
                </button>
                <button type="button" disabled={busy || !text.trim()} onClick={() => void send('ask')}>
                  {t('ui.ask')}
                </button>
                <button type="button" disabled={busy} onClick={() => void send('pass')}>
                  {t('ui.pass')}
                </button>
                {session.pendingOperation?.canRetry ? (
                  <button type="button" disabled={busy} onClick={() => void confirm('retry')}>
                    {t('ui.retry')}
                  </button>
                ) : null}
              </div>
            </>
          )}
          {error ? <p className={styles.warn}>{error}</p> : null}
        </footer>
      ) : null}
    </div>
  );
}

function MessageBlock({ message }: { message: Message }) {
  const payload = message.payload;
  if (message.kind === 'gm' || message.kind === 'ending') {
    const paragraphs = payload.paragraphs;
    return (
      <div className={styles.gm}>
        {Array.isArray(paragraphs)
          ? paragraphs.map((paragraph) => <p key={String(paragraph)}>{String(paragraph)}</p>)
          : null}
      </div>
    );
  }
  if (message.kind === 'player') {
    return <p className={styles.player}>{String(payload.text ?? '')}</p>;
  }
  if (message.kind === 'check') {
    return (
      <p className={styles.check}>
        {String(payload.attribute)} {String(payload.die)}+{String(payload.attributeValue)} ={' '}
        {String(payload.total)} vs {String(payload.target)} → {String(payload.outcome)}
      </p>
    );
  }
  return null;
}
