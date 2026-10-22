export function Unavailable({
  correlationId,
}: Readonly<{ correlationId?: string }>) {
  return (
    <section role="alert">
      <h1>We couldn't load your garden</h1>
      <p>Please try again in a moment.</p>
      {correlationId && <p className="muted">Reference: {correlationId}</p>}
      <a href="">Try again</a>
    </section>
  );
}
