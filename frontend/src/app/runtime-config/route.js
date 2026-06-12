// Config lida em TEMPO DE EXECUÇÃO (não no build). Define window.ENV_API_URL a
// partir da variável de ambiente API_URL (ou NEXT_PUBLIC_API_URL), para que a
// URL do backend possa ser trocada sem rebuildar o frontend.
export const dynamic = "force-dynamic";

export function GET() {
  const url = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const body = `window.ENV_API_URL=${JSON.stringify(url)};`;
  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
