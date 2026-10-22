export function requireDatabaseUrl(value: unknown): string {
  try {
    if (typeof value !== "string" || value.trim() !== value) throw new Error();
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname.length < 2 ||
      value.includes("replace_")
    )
      throw new Error();
    return value;
  } catch {
    throw new Error("Database configuration is unavailable.");
  }
}
