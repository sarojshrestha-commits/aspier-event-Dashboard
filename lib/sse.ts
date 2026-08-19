// In-memory SSE event broadcast system
type ClientController = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  sessionId: string;
};

const clients = new Map<string, Set<ClientController>>();

export function registerClient(
  sessionId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
): () => void {
  const clientController = { controller, sessionId };

  if (!clients.has(sessionId)) {
    clients.set(sessionId, new Set());
  }
  clients.get(sessionId)!.add(clientController);

  // Return unsubscribe function
  return () => {
    clients.get(sessionId)?.delete(clientController);
    if (clients.get(sessionId)?.size === 0) {
      clients.delete(sessionId);
    }
  };
}

export function broadcastToSession(
  sessionId: string,
  event: string,
  data: unknown
): void {
  const sessionClients = clients.get(sessionId);
  if (!sessionClients) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(message);

  for (const client of sessionClients) {
    try {
      client.controller.enqueue(encoded);
    } catch (error) {
      // Client disconnected, will be cleaned up on error
      clients.get(sessionId)?.delete(client);
    }
  }
}

export function getActiveSessionCount(sessionId: string): number {
  return clients.get(sessionId)?.size || 0;
}
