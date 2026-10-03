'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
  ability: { name: string; cost: number; attribute: string };
  overwhelmed: boolean;
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
    canRest: boolean;
    plate: string;
  };
  objective: { text: string };
  inventory: Array<{ itemId: string; name: string; description: string; quantity: number; usable: boolean }>;
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const imeLock = useRef(false);
  const storyTail = session?.recentMessages.at(-1)?.id ?? '';
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const node = storyRef.current;
      if (!node) return;
      if (node.scrollHeight > node.clientHeight + 1) {
        node.scrollTop = node.scrollHeight;
      }
      node.querySelector('[data-story-end]')?.scrollIntoView({ block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [session?.revision, storyTail]);

  async function commit(body: Record<string, unknown>) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      let result = await api<ActionResponse>('/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          expectedRevision: session.revision,
          actorId: session.turn.activePlayerId,
          ...body,
        }),
      });
      const pending = result.session.pendingOperation;
      if (pending?.phase === 'awaiting_confirmation') {
        result = await api<ActionResponse>(`/api/actions/${pending.id}/confirm`, {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: result.session.revision }),
        });
      }
      setSession(result.session);
      setText('');
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
      if (path !== 'cancel') setText('');
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
  const retrying = Boolean(session.pendingOperation?.canRetry);
  const writing = Boolean(
    session.pendingOperation &&
      ['interpreting', 'resolving', 'narrating', 'awaiting_confirmation'].includes(
        session.pendingOperation.phase,
      ),
  );

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
              <p className={styles.role}>
                {member.role}
                {member.overwhelmed ? ` · ${t('ui.downed')}` : ''}
              </p>
              <Meter label="HP" value={member.hp} max={member.maxHp} kind="hp" />
              <Meter label="MP" value={member.mp} max={member.maxMp} kind="mp" />
            </div>
          </article>
        ))}
      </aside>
      <div className={styles.storyWrap} ref={storyRef}>
        <main className={styles.story}>
          <p className={styles.place}>
            {session.scene.location} · {session.scene.title}
          </p>
          <div className={styles.plateFrame}>
            <Image
              className={styles.plate}
              src={session.scene.plate}
              alt=""
              fill
              sizes="(max-width: 980px) 100vw, 720px"
            />
          </div>
          {session.recentMessages.map((message) => (
            <MessageBlock
              key={message.id}
              message={message}
              party={session.party}
              locale={locale}
              t={t}
            />
          ))}
          {session.ending ? (
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
          <div className={styles.storyEnd} data-story-end="" />
        </main>
      </div>
      <aside className={styles.side}>
        <section className={styles.panel}>
          <h2>{t('ui.objective')}</h2>
          <div className={styles.panelBody}>
            <p>{session.objective.text}</p>
            <div className={styles.meters}>
              <span>
                {t('ui.progress')} {session.scene.progress}/{session.scene.progressTarget}
              </span>
              <Pips
                value={session.scene.progress}
                max={session.scene.progressTarget}
                kind="progress"
              />
              <span>
                {t('ui.threat')} {session.scene.threat}/{session.scene.threatLimit}
              </span>
              <Pips value={session.scene.threat} max={session.scene.threatLimit} kind="threat" />
            </div>
            <p className={styles.hint}>{t('ui.metersHint')}</p>
          </div>
        </section>
        <section className={styles.panel}>
          <h2>{t('ui.inventory')}</h2>
          <ul className={styles.items}>
            {session.inventory.map((item) => (
              <li key={`${item.itemId}-${item.name}`}>
                <ItemGlyph itemId={item.itemId} />
                <span className={styles.itemCopy}>
                  <span>{item.name}</span>
                  {item.usable ? <span className={styles.itemDesc}>{item.description}</span> : null}
                </span>
                <span className={styles.qty}>× {item.quantity}</span>
                {item.usable ? (
                  <div className={styles.itemUses}>
                    {session.party.map((member) => (
                      <button
                        key={member.playerId}
                        type="button"
                        className={styles.itemButton}
                        disabled={busy || (member.hp <= 0 && !item.itemId.includes('restor'))}
                        onClick={() =>
                          void commit({
                            kind: 'use_item',
                            itemId: item.itemId,
                            targetPlayerId: member.playerId,
                          })
                        }
                      >
                        {t('ui.useOn', { name: member.displayName })}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </aside>
      {session.status === 'active' && !session.ending ? (
        <footer className={styles.composer}>
          {writing ? <p className={styles.hint}>{t('ui.writing')}</p> : null}
          <div className={styles.sideCol}>
            <div className={styles.approaches}>
              <p>{t('ui.approaches')}</p>
              {session.suggestions.map((suggestion) => {
                const attribute = suggestion.approachId?.split('-').at(-1);
                const abilityFits =
                  Boolean(active) &&
                  attribute === active?.ability.attribute &&
                  (active?.mp ?? 0) >= (active?.ability.cost ?? 2) &&
                  !active?.overwhelmed;
                return (
                  <span key={suggestion.text} className={styles.approachRow}>
                    <button
                      type="button"
                      disabled={busy || !suggestion.text}
                      onClick={() => void commit({ kind: 'act', text: suggestion.text, useAbility: false })}
                    >
                      {suggestion.text}
                    </button>
                    {abilityFits && active ? (
                      <button
                        type="button"
                        className={styles.ability}
                        disabled={busy}
                        onClick={() =>
                          void commit({ kind: 'act', text: suggestion.text, useAbility: true })
                        }
                      >
                        {t('ui.abilityChip', {
                          name: active.ability.name,
                          cost: String(active.ability.cost),
                        })}
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
          <div className={styles.entry}>
            <p className={styles.turn}>{t('ui.turn', { name: active?.displayName ?? '' })}</p>
            <textarea
              value={text}
              maxLength={600}
              onChange={(event) => setText(event.target.value)}
              onCompositionStart={() => {
                imeLock.current = true;
              }}
              onCompositionEnd={() => {
                imeLock.current = true;
                window.setTimeout(() => {
                  imeLock.current = false;
                }, 0);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return;
                if (imeLock.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                if (busy || !text.trim()) return;
                void commit({ kind: 'act', text, useAbility: false });
              }}
              placeholder={t('ui.composerHint')}
            />
          </div>
          <div className={styles.commands}>
            <button
              type="button"
              className={styles.act}
              disabled={busy || !text.trim()}
              onClick={() => void commit({ kind: 'act', text, useAbility: false })}
            >
              {t('ui.act')}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={busy || !text.trim()}
              onClick={() => void commit({ kind: 'ask', text })}
            >
              {t('ui.ask')}
            </button>
            {retrying ? (
              <button type="button" className={styles.ghost} disabled={busy} onClick={() => void confirm('retry')}>
                {t('ui.retry')}
              </button>
            ) : null}
          </div>
          {session.pendingOperation?.errorCode ? (
            <p className={styles.warn}>{pendingErrorText(session.pendingOperation.errorCode, t)}</p>
          ) : null}
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
    const harm = entry as { playerId?: unknown; hp?: unknown; mp?: unknown; cause?: unknown };
    const name = party.find((member) => member.playerId === harm.playerId)?.displayName;
    const hp = typeof harm.hp === 'number' ? harm.hp : 0;
    const mp = typeof harm.mp === 'number' ? harm.mp : 0;
    if (!name || (hp <= 0 && mp <= 0)) return [];
    const key = hp > 0 && mp > 0 ? 'ui.harmBoth' : hp > 0 ? 'ui.harmHp' : 'ui.harmMp';
    const cause = typeof harm.cause === 'string' && harm.cause ? ` — 「${harm.cause}」` : '';
    return [`${t(key, { name, hp: String(hp), mp: String(mp) })}${cause}`];
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

function StoryParagraph({
  text,
  party,
}: {
  text: string;
  party: Array<{ displayName: string }>;
}) {
  const names = [
    ...party.map((member) => member.displayName),
    '塔維',
    '奧倫',
    '梅菈',
    '薇絲珀',
    'Tavi',
    'Orren',
    'Maera',
    'Vesper',
  ];
  const speaker = names.findIndex((name) => name.length > 0 && text.includes(name));
  const parts = text.split(/(「[^」]*」)/u);
  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith('「') ? (
          <span key={index} className={styles.speech} data-speaker={String(Math.max(speaker, 0) % 7)}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
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
          ? paragraphs.map((paragraph) => (
              <StoryParagraph
                key={String(paragraph)}
                text={String(paragraph)}
                party={party}
              />
            ))
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
