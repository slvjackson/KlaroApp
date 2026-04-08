const domain = process.env.EXPO_PUBLIC_DOMAIN;

export function getApiBaseUrl(): string {
  if (!domain) return "";
  const protocol =
    domain.startsWith("localhost") || domain.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${domain}`;
}
