'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { faceForPlayer, readFaceMap } from '@/lib/portraits';
import { uiString } from '@/shared/i18n';
import type { Locale } from '@/shared/schemas';
import { Portrait } from '@/components/Portrait';
import styles from './GameShell.module.css';

type Message = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
};

type PartyMember = {
  playerId: string;
  seat: number;
  displayName: string;
  characterName: string;
  role: string;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  active: boolean;
  ability: { name: string; cost: number };
};

type Session = {
  sessionId: string;
  revision: number;
  locale: Locale;
  status: string;
  savedAt: string;
  world: { title: string };
  party: PartyMember[];
  turn: { activePlayerId: string; round: number };
  scene: {
    title: string;
    location: string;
    description: string;
    index: number;
    progress: number;
    threat: number;
    progressTarget: number;
    threatLimit: number;
  };
  objective: { text: string };
  inventory: Array<{ itemId: string; name: string; quantity: number }>;
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
      tollHp?: number;
      tollMp?: number;
    } | null;
    errorCode: string | null;
  } | null;
  ending: { kind: string; summary: string; epilogues: Array<{ playerId: string; text: string }> } | null;
};

type ActionResponse = { session: Session; operation?: Session['pendingOperation'] };

export function GameShell() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [faceMap, setFaceMap] = useState<Record<string, string>>({});
  const [text, setText] = useState('');
  const [useAbility, setUseAbility] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locale: Locale = session?.locale ?? 'zh-Hant';
  const t = (key: Parameters<typeof uiString>[1], vars?: Record<string, string>) =>
    uiString(locale, key, vars);

  useEffect(() => {
    let cancelled = false;
    void api<{ session: Session | null }>('/api/session')
      .then((data) => {
        if (cancelled) return;
        if (!data.session) {
          router.replace('/');
          return;
        }
        setFaceMap(readFaceMap(data.session.sessionId));
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
    return <p className={styles.loading}>{error ?? `${t('ui.saved')}…`}</p>;
  }

  const active = session.party.find((member) => member.playerId === session.turn.activePlayerId);
  const preview = session.pendingOperation?.preview;
  const awaiting = session.pendingOperation?.phase === 'awaiting_confirmation';
  const lost = session.party.some((member) => member.hp <= 0);

  return (
    <div className={styles.shell} data-testid="stage">
      <header className={styles.top}>
        <h1 className={styles.plaque}>{session.world.title}</h1>
        <div className={styles.topMeta}>
          <p className={styles.saved}>
            {t('ui.saved')} · {savedLabel(session.savedAt, locale)}
          </p>
          <button type="button" className={styles.leave} onClick={() => router.push('/')}>
            {t('ui.leave')}
          </button>
        </div>
      </header>
      <aside className={styles.party}>
        {session.party.map((member) => (
          <article
            key={member.playerId}
            className={member.active ? `${styles.card} ${styles.active}` : styles.card}
          >
            <div
              className={member.active ? styles.portraitActive : styles.portraitFrame}
              data-face-id={faceForPlayer(faceMap, member.playerId, member.seat)}
            >
              <Portrait
                id={faceForPlayer(faceMap, member.playerId, member.seat)}
                locale={locale}
                className={styles.face}
              />
            </div>
            <div className={styles.meta}>
              <h2>{member.displayName}</h2>
              <p className={styles.role}>{member.role}</p>
              <Meter label="HP" value={member.hp} max={member.maxHp} kind="hp" />
              <Meter label="MP" value={member.mp} max={member.maxMp} kind="mp" />
            </div>
          </article>
        ))}
      </aside>
      <div className={styles.storyWrap}>
        <main className={styles.story}>
          <p className={styles.place}>
            {session.scene.location} · {session.scene.title}
          </p>
          {session.recentMessages.map((message) => (
            <MessageBlock
              key={message.id}
              message={message}
              party={session.party}
              locale={locale}
              t={t}
            />
          ))}
          {lost ? (
            <section className={`${styles.ending} ${styles.lost}`}>
              <h2>{t('ui.lost')}</h2>
              <p>{session.ending?.summary ?? t('ui.lostDetail')}</p>
              <button type="button" onClick={() => router.push('/')}>
                {t('ui.backToLobby')}
              </button>
            </section>
          ) : session.ending ? (
            <section className={styles.ending}>
              <h2>
                {t('ui.ending')}: {session.ending.kind}
              </h2>
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
      </div>
      <aside className={styles.side}>
        <section className={styles.panel}>
          <h2>{t('ui.objective')}</h2>
          <div className={styles.panelBody}>
            <p>{session.objective.text}</p>
            <div className={styles.meters}>
              <span>
                {session.scene.progress}/{session.scene.progressTarget}
              </span>
              <Pips
                value={session.scene.progress}
                max={session.scene.progressTarget}
                kind="progress"
              />
              <span>
                {session.scene.threat}/{session.scene.threatLimit}
              </span>
              <Pips value={session.scene.threat} max={session.scene.threatLimit} kind="threat" />
            </div>
          </div>
        </section>
        <section className={styles.panel}>
          <h2>{t('ui.inventory')}</h2>
          <ul className={styles.items}>
            {session.inventory.map((item) => (
              <li key={`${item.itemId}-${item.name}`}>
                <ItemGlyph itemId={item.itemId} />
                <span>{item.name}</span>
                <span className={styles.qty}>× {item.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
      {session.status === 'active' && !lost ? (
        <footer className={styles.composer}>
          {preview ? (
            <div className={styles.preview}>
              <h3>{t('ui.preview')}</h3>
              <p className={styles.actionText}>{preview.actionText}</p>
              <p>
                {preview.attribute} DC {preview.target}
                {preview.mpCost ? ` · MP ${preview.mpCost}` : ''}
              </p>
              {preview.tollHp || preview.tollMp ? (
                <p>
                  {t('ui.toll', {
                    hp: String(preview.tollHp ?? 0),
                    mp: String(preview.tollMp ?? 0),
                  })}
                </p>
              ) : null}
              <p>{preview.stakes.success}</p>
              <p>{preview.stakes.partial}</p>
              <p>{preview.stakes.failure}</p>
              <div className={styles.previewActions}>
                {awaiting ? (
                  <button type="button" className={styles.act} disabled={busy} onClick={() => void confirm('confirm')}>
                    {t('ui.confirm')}
                  </button>
                ) : null}
                {session.pendingOperation?.canCancel && awaiting ? (
                  <button type="button" className={styles.ghost} disabled={busy} onClick={() => void confirm('cancel')}>
                    {t('ui.cancel')}
                  </button>
                ) : null}
                {session.pendingOperation?.canRetry ? (
                  <button type="button" className={styles.ghost} disabled={busy} onClick={() => void confirm('retry')}>
                    {t('ui.retry')}
                  </button>
                ) : null}
              </div>
              {session.pendingOperation?.errorCode ? (
                <p className={styles.warn}>
                  {pendingErrorText(session.pendingOperation.errorCode, t)}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className={styles.sideCol}>
                <div className={styles.approaches}>
                  <p>{t('ui.approaches')}</p>
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
                <button
                  type="button"
                  className={useAbility ? styles.abilityOn : styles.ability}
                  aria-pressed={useAbility}
                  onClick={() => setUseAbility((value) => !value)}
                >
                  {t('ui.ability')}
                  {active ? ` · ${active.ability.name} (${active.ability.cost} MP)` : ''}
                </button>
              </div>
              <div className={styles.entry}>
                <p className={styles.turn}>{t('ui.turn', { name: active?.displayName ?? '' })}</p>
                <textarea
                  value={text}
                  maxLength={600}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t('ui.composerHint')}
                />
              </div>
              <div className={styles.commands}>
                <button
                  type="button"
                  className={styles.act}
                  disabled={busy || !text.trim()}
                  onClick={() => void send('act')}
                >
                  {t('ui.act')}
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy || !text.trim()}
                  onClick={() => void send('ask')}
                >
                  {t('ui.ask')}
                </button>
                <button type="button" className={styles.ghost} disabled={busy} onClick={() => void send('pass')}>
                  {t('ui.pass')}
                </button>
                {session.pendingOperation?.canRetry ? (
                  <button type="button" className={styles.ghost} disabled={busy} onClick={() => void confirm('retry')}>
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

function Meter({
  label,
  value,
  max,
  kind,
}: {
  label: string;
  value: number;
  max: number;
  kind: 'hp' | 'mp';
}) {
  const width = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={styles.meter}>
      <span>
        {label} {value}/{max}
      </span>
      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span className={kind === 'hp' ? styles.hp : styles.mp} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Pips({ value, max, kind }: { value: number; max: number; kind: 'progress' | 'threat' }) {
  const count = Math.max(0, max);
  return (
    <div className={styles.pips} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={index < value ? styles.pipOn : styles.pip}
          data-kind={kind}
        />
      ))}
    </div>
  );
}

function savedLabel(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === 'zh-Hant' ? 'zh-Hant' : 'en-GB', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: locale === 'zh-Hant',
  });
}

function pendingErrorText(
  code: string,
  t: (key: Parameters<typeof uiString>[1]) => string,
): string {
  if (code === 'AI_INVALID_OUTPUT') return t('error.AI_INVALID_OUTPUT');
  if (code === 'AI_TIMEOUT') return t('error.AI_TIMEOUT');
  if (code === 'AI_UNAVAILABLE') return t('error.AI_UNAVAILABLE');
  if (code === 'AI_NOT_CONFIGURED') return t('error.AI_NOT_CONFIGURED');
  return code;
}

function HarmNotes({
  payload,
  party,
  t,
}: {
  payload: Record<string, unknown>;
  party: Array<{ playerId: string; displayName: string }>;
  t: (key: Parameters<typeof uiString>[1], vars?: Record<string, string>) => string;
}) {
  if (!Array.isArray(payload.harms)) return null;
  const lines = payload.harms.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const harm = entry as { playerId?: unknown; hp?: unknown; mp?: unknown };
    const name = party.find((member) => member.playerId === harm.playerId)?.displayName;
    const hp = typeof harm.hp === 'number' ? harm.hp : 0;
    const mp = typeof harm.mp === 'number' ? harm.mp : 0;
    if (!name || (hp <= 0 && mp <= 0)) return [];
    const key = hp > 0 && mp > 0 ? 'ui.harmBoth' : hp > 0 ? 'ui.harmHp' : 'ui.harmMp';
    return [t(key, { name, hp: String(hp), mp: String(mp) })];
  });
  if (lines.length === 0) return null;
  return (
    <div className={styles.harm}>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function outcomeLabel(
  outcome: string,
  t: (key: Parameters<typeof uiString>[1]) => string,
): string {
  if (outcome === 'success') return t('check.success');
  if (outcome === 'partial') return t('check.partial');
  if (outcome === 'failure') return t('check.failure');
  return outcome;
}

function MessageBlock({
  message,
  party,
  locale,
  t,
}: {
  message: Message;
  party: Array<{ playerId: string; displayName: string }>;
  locale: Locale;
  t: (key: Parameters<typeof uiString>[1]) => string;
}) {
  const payload = message.payload;
  if (message.kind === 'gm' || message.kind === 'ending') {
    const paragraphs = payload.paragraphs;
    return (
      <div className={styles.gm}>
        {Array.isArray(paragraphs)
          ? paragraphs.map((paragraph) => <p key={String(paragraph)}>{String(paragraph)}</p>)
          : null}
        <HarmNotes payload={payload} party={party} t={t} />
      </div>
    );
  }
  if (message.kind === 'player') {
    const speaker = party.find((member) => member.playerId === payload.actorId)?.displayName;
    const text = String(payload.text ?? '');
    const sep = locale === 'zh-Hant' ? '：' : ': ';
    return <p className={styles.player}>{speaker ? `${speaker}${sep}${text}` : text}</p>;
  }
  if (message.kind === 'check') {
    const speaker = party.find((member) => member.playerId === payload.actorId)?.displayName;
    return (
      <p className={styles.check}>
        {speaker ? `${speaker} · ` : ''}
        {String(payload.attribute)} {String(payload.die)}+{String(payload.attributeValue)} ={' '}
        {String(payload.total)} vs {String(payload.target)} →{' '}
        {outcomeLabel(String(payload.outcome), t)}
      </p>
    );
  }
  return null;
}

function itemGlyph(itemId: string): 'vial' | 'leaf' | 'sword' | 'book' | 'ring' | 'map' | 'seal' {
  if (itemId.includes('restor')) return 'vial';
  if (itemId.includes('focus')) return 'leaf';
  if (itemId.includes('sword')) return 'sword';
  if (itemId.includes('codex')) return 'book';
  if (itemId.includes('signet')) return 'ring';
  if (itemId.includes('map')) return 'map';
  return 'seal';
}

function ItemGlyph({ itemId }: { itemId: string }) {
  const kind = itemGlyph(itemId);
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'vial' ? <path d="M9 3h6M12 3v3M8 8h8l-1.2 12h-5.6L8 8z" /> : null}
      {kind === 'leaf' ? <path d="M5 19c4-1 8-5 9-13 4 2 6 7 5 12-4 1-9 2-14 1z" /> : null}
      {kind === 'sword' ? <path d="M12 3v13M9 16h6M12 16l-1 5h2zM8 8h8" /> : null}
      {kind === 'book' ? <path d="M5 4h6a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM14 4h5v13a3 3 0 0 1-3 3h-2" /> : null}
      {kind === 'ring' ? <path d="M12 8v2M8 14a4 4 0 1 0 8 0 4 4 0 0 0-8 0z" /> : null}
      {kind === 'map' ? <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14" /> : null}
      {kind === 'seal' ? <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10v3l2 2" /> : null}
    </svg>
  );
}
