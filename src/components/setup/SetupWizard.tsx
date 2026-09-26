'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { uiString } from '@/shared/i18n';
import type { Locale } from '@/shared/schemas';
import styles from './SetupWizard.module.css';

type Catalog = {
  locale: Locale;
  worlds: Array<{
    id: string;
    title: string;
    premise: string;
    tone: string;
    characters: Array<{
      id: string;
      name: string;
      role: string;
      profile: string;
      biography: string;
    }>;
  }>;
};

type SessionEnvelope = { session: { sessionId: string } | null };

export function SetupWizard() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('zh-Hant');
  const [count, setCount] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [worldId] = useState('ashen-thrones');
  const [names, setNames] = useState(['', '', '', '']);
  const [characters, setCharacters] = useState<(string | null)[]>([null, null, null, null]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(true);
  const t = (key: Parameters<typeof uiString>[1]) => uiString(locale, key);

  useEffect(() => {
    void api<SessionEnvelope>('/api/session').then((data) => {
      setHasSession(Boolean(data.session));
    });
    void api<{ aiConfigured: boolean }>('/api/health').then((data) => {
      setAiConfigured(data.aiConfigured);
    });
  }, []);

  useEffect(() => {
    void api<Catalog>(`/api/catalog?locale=${locale}`).then(setCatalog);
  }, [locale]);

  const world = catalog?.worlds.find((entry) => entry.id === worldId) ?? catalog?.worlds[0];

  async function begin(replace = false) {
    if (!world) return;
    setBusy(true);
    setError(null);
    const used = new Set<string>();
    const players = Array.from({ length: count }, (_, index) => {
      const chosen =
        characters[index] && !used.has(characters[index]!)
          ? characters[index]!
          : (world.characters.find((character) => !used.has(character.id))?.id ?? '');
      used.add(chosen);
      return {
        displayName: names[index]?.trim() || world.characters.find((character) => character.id === chosen)?.name || `P${index + 1}`,
        characterId: chosen,
      };
    });
    try {
      const existing = await api<SessionEnvelope>('/api/session');
      await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({
          createRequestId: crypto.randomUUID(),
          worldId: world.id,
          locale,
          players,
          ...(replace && existing.session
            ? { replaceSessionId: existing.session.sessionId }
            : {}),
        }),
      });
      router.push('/play');
    } catch (caught) {
      const code = (caught as { code?: string }).code;
      if (code === 'REPLACEMENT_REQUIRED') {
        setError(t('ui.replace'));
      } else {
        setError((caught as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>{t('ui.brand')}</p>
      <h1 className={styles.title}>異境物語</h1>
      <label className={styles.field}>
        {t('ui.language')}
        <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
          <option value="zh-Hant">繁體中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className={styles.field}>
        {t('ui.players')}
        <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      {world ? (
        <section className={styles.world}>
          <h2>{world.title}</h2>
          <p>{world.premise}</p>
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className={styles.seat}>
              <label>
                {t('ui.displayName')} {index + 1}
                <input
                  maxLength={24}
                  value={names[index] ?? ''}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}
                />
              </label>
              <label>
                {t('ui.character')}
                <select
                  value={characters[index] ?? ''}
                  onChange={(event) => {
                    const next = [...characters];
                    next[index] = event.target.value;
                    setCharacters(next);
                  }}
                >
                  <option value="">{t('ui.character')}</option>
                  {world.characters.map((character) => (
                    <option
                      key={character.id}
                      value={character.id}
                      disabled={characters.some(
                        (id, seat) => seat !== index && id === character.id,
                      )}
                    >
                      {character.name} · {character.role}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.bio}>
                {
                  world.characters.find(
                    (character) => character.id === (characters[index] ?? world.characters[index]?.id),
                  )?.biography
                }
              </p>
            </div>
          ))}
        </section>
      ) : null}
      {!aiConfigured ? <p className={styles.warn}>{t('ui.needAi')}</p> : null}
      {error ? <p className={styles.warn}>{error}</p> : null}
      <div className={styles.actions}>
        {hasSession ? (
          <button type="button" onClick={() => router.push('/play')}>
            {t('ui.resume')}
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void begin(error === t('ui.replace'))}>
          {t('ui.begin')}
        </button>
      </div>
    </main>
  );
}
