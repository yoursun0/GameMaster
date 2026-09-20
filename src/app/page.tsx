import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>TALES BEYOND</p>
      <h1 className={styles.title}>異境物語</h1>
      <p className={styles.copy}>
        Shared-screen setup and play are not available yet.
      </p>
    </main>
  );
}
