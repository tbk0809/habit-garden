const steps: Record<string, string> = {
  integration:
    "The real PostgreSQL integration suite is not implemented. Complete task 4 before running this gate.",
  e2e: "The browser journeys and disposable database session fixtures are not implemented. Complete task 8 before running this gate.",
  migrate:
    "Reviewed SQL migrations and the guarded migration runner are not implemented. Complete task 4 before changing a database.",
  seed: "The guarded local seed runner is not implemented. Complete task 4 before writing fixture data.",
};

console.error(steps[process.argv[2] ?? ""] ?? "Unknown prerequisite gate.");
process.exitCode = 1;
