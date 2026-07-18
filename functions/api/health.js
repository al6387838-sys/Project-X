export async function onRequest(context) {
  return new Response(JSON.stringify({
    status: "ok",
    version: "v35.0",
    buildId: "BUILD-20260718014737",
    commit: "LATEST",
    environment: "production",
    timestamp: new Date().toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
