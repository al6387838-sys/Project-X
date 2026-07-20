export async function onRequest(context) {
  return new Response(JSON.stringify({
    status: "ok",
    version: "v46.0.0",
    buildId: "BUILD-20260720213738",
    commit: "LATEST",
    environment: "production",
    timestamp: new Date().toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
