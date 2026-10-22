import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <p className={styles.label}>Daily habits, steady growth</p>
      <h1>Habit Garden</h1>
      <p>
        The garden is taking root. Habit tracking and sign-in are still being
        built.
      </p>
    </main>
  );
}
