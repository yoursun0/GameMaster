'use client';

import { PORTRAITS, portraitById, stepFace } from '@/lib/portraits';
import type { Locale } from '@/shared/schemas';
import { Portrait } from '@/components/Portrait';
import styles from './FacePicker.module.css';

export function FacePicker({
  faceId,
  locale,
  taken,
  label,
  prevLabel,
  nextLabel,
  pool,
  onChange,
}: {
  faceId: string;
  locale: Locale;
  taken: ReadonlySet<string>;
  label: string;
  prevLabel: string;
  nextLabel: string;
  pool?: readonly string[];
  onChange: (faceId: string) => void;
}) {
  const faces = pool ?? PORTRAITS.map((entry) => entry.id);
  const portrait = portraitById(faceId);
  const index = Math.max(0, faces.indexOf(portrait.id));

  return (
    <div className={styles.picker} data-testid="face-picker" data-face-id={portrait.id}>
      <p className={styles.label}>{label}</p>
      <div className={styles.stage}>
        <button
          type="button"
          className={styles.arrow}
          aria-label={prevLabel}
          onClick={() => onChange(stepFace(portrait.id, -1, taken, faces))}
        >
          ‹
        </button>
        <div className={styles.frame}>
          <Portrait id={portrait.id} locale={locale} className={styles.face} />
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label={nextLabel}
          onClick={() => onChange(stepFace(portrait.id, 1, taken, faces))}
        >
          ›
        </button>
      </div>
      <p className={styles.caption}>
        {portrait.alt[locale]}
        <span>
          {index + 1}/{faces.length}
        </span>
      </p>
      <div className={styles.strip} role="listbox" aria-label={label}>
        {faces.map((faceId) => {
          const entry = portraitById(faceId);
          const selected = entry.id === portrait.id;
          const blocked = taken.has(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={entry.alt[locale]}
              disabled={blocked}
              className={selected ? styles.thumbOn : styles.thumb}
              onClick={() => onChange(entry.id)}
            >
              <Portrait id={entry.id} locale={locale} className={styles.thumbFace} decorative />
            </button>
          );
        })}
      </div>
    </div>
  );
}
