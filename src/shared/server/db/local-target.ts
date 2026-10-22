export function assertLocalDatabaseTarget(
  value: unknown,
  environment: unknown,
  purpose: "seed" | "test",
): asserts value is string {
  const database =
    purpose === "seed" ? "habit_garden_dev" : "habit_garden_test";
  const requiredEnvironment = purpose === "seed" ? "development" : "test";
  try {
    if (
      typeof value !== "string" ||
      value.trim() !== value ||
      environment !== requiredEnvironment
    )
      throw new Error();
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !url.username ||
      !url.password ||
      url.search ||
      url.hash ||
      url.pathname !== `/${database}` ||
      !value.endsWith(`@${url.host}/${database}`) ||
      value.includes("replace_")
    )
      throw new Error();
  } catch {
    throw new Error("Local database target refused.");
  }
}
