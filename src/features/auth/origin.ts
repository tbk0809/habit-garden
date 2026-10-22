export function allowsAuthRequest(
  request: Request,
  canonicalUrl: string,
): boolean {
  const origin = new URL(canonicalUrl).origin;
  return (
    new URL(request.url).origin === origin &&
    (request.method !== "POST" ||
      !request.headers.has("origin") ||
      request.headers.get("origin") === origin)
  );
}
