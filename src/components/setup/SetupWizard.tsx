'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { dealFaces, saveFaceMap } from '@/lib/portraits';
import { uiString } from '@/shared/i18n';
import type { Locale } from '@/shared/schemas';
import { FacePicker } from './FacePicker';
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

type SessionEnvelope = {
  session: {
    sessionId: string;
    party?: Array<{ playerId: string; seat: number }>;
  } | null;
};

export function SetupWizard() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('zh-Hant');
  const [count, setCount] = useState(1);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [worldId] = useState('ashen-thrones');
  const [names, setNames] = useState(['', '', '', '']);
  const [nameTouched, setNameTouched] = useState([false, false, false, false]);
  const [characters, setCharacters] = useState<(string | null)[]>([null, null, null, null]);
  const [faces, setFaces] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(true);
  const t = (key: Parameters<typeof uiString>[1]) => uiString(locale, key);

  useEffect(() => {
    // Deal after mount so the server render and the first client render stay in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- random faces cannot be chosen during SSR
    setFaces(dealFaces(4));
  }, []);

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

  function seatCharacter(index: number) {
    const id = characters[index];
    if (id) return world?.characters.find((character) => character.id === id);
    return world?.characters[index];
  }

  function spokenName(index: number): string {
    if (nameTouched[index]) return names[index] ?? '';
    return seatCharacter(index)?.name ?? '';
  }

  async function begin() {
    if (!world || !faces) return;
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
        displayName:
          spokenName(index).trim() ||
          world.characters.find((character) => character.id === chosen)?.name ||
          `P${index + 1}`,
        characterId: chosen,
      };
    });
    try {
      const existing = await api<SessionEnvelope>('/api/session');
      const created = await api<SessionEnvelope>('/api/session', {
        method: 'POST',
        body: JSON.stringify({
          createRequestId: crypto.randomUUID(),
          worldId: world.id,
          locale,
          players,
          ...(existing.session ? { replaceSessionId: existing.session.sessionId } : {}),
        }),
      });
      if (created.session?.party) {
        saveFaceMap(created.session.sessionId, created.session.party, faces);
      }
      router.push('/play');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.plaque}>{world?.title ?? t('ui.brand')}</h1>
        <div className={styles.tools}>
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
        </div>
      </header>
      {world ? (
        <>
          <p className={styles.premise}>{world.premise}</p>
          <section className={styles.seats}>
            {Array.from({ length: count }, (_, index) => {
              const taken = new Set(
                (faces ?? []).filter((id, seat) => seat !== index && seat < count),
              );
              const selectedId = characters[index] ?? world.characters[index]?.id;
              return (
                <article key={index} className={styles.seat}>
                  {faces ? (
                    <FacePicker
                      faceId={faces[index] ?? faces[0] ?? ''}
                      locale={locale}
                      taken={taken}
                      label={t('ui.face')}
                      prevLabel={t('ui.facePrev')}
                      nextLabel={t('ui.faceNext')}
                      onChange={(faceId) => {
                        setFaces((current) => {
                          if (!current) return current;
                          const next = [...current];
                          next[index] = faceId;
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <div className={styles.pending} />
                  )}
                  <label className={styles.field}>
                    {t('ui.displayName')} {index + 1}
                    <input
                      maxLength={24}
                      autoComplete="off"
                      placeholder={seatCharacter(index)?.name ?? ''}
                      value={spokenName(index)}
                      onChange={(event) => {
                        const nextNames = [...names];
                        nextNames[index] = event.target.value;
                        setNames(nextNames);
                        const nextTouched = [...nameTouched];
                        nextTouched[index] = true;
                        setNameTouched(nextTouched);
                      }}
                    />
                  </label>
                  <label className={styles.field}>
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
                    {world.characters.find((character) => character.id === selectedId)?.biography}
                  </p>
                </article>
              );
            })}
          </section>
        </>
      ) : null}
      {!aiConfigured ? <p className={styles.warn}>{t('ui.needAi')}</p> : null}
      {error ? <p className={styles.warn}>{error}</p> : null}
      <div className={styles.actions}>
        {hasSession ? (
          <button type="button" className={styles.ghost} onClick={() => router.push('/play')}>
            {t('ui.resume')}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.begin}
          disabled={busy || !faces}
          onClick={() => void begin()}
        >
          {t('ui.begin')}
        </button>
      </div>
    </main>
  );
}
