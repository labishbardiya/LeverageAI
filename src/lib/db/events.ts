/**
 * Lightweight in-process event bus for SSE / polling notifications.
 * Works with both memory and postgres backends (app-level only).
 */

export type StoreEvent =
  | {
      type: "transcript";
      job_id: string;
      session_id: string;
      payload: unknown;
    }
  | {
      type: "quote";
      job_id: string;
      session_id: string;
      payload: unknown;
    }
  | {
      type: "session";
      job_id: string;
      session_id: string;
      payload: unknown;
    }
  | {
      type: "job";
      job_id: string;
      session_id?: string;
      payload: unknown;
    };

type Listener = (event: StoreEvent) => void;

interface Bus {
  listeners: Set<Listener>;
}

function getBus(): Bus {
  const g = globalThis as unknown as { __negotiatorEvents?: Bus };
  if (!g.__negotiatorEvents) {
    g.__negotiatorEvents = { listeners: new Set() };
  }
  return g.__negotiatorEvents;
}

export function publish(event: StoreEvent): void {
  for (const l of getBus().listeners) {
    try {
      l(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribe(listener: Listener): () => void {
  const bus = getBus();
  bus.listeners.add(listener);
  return () => {
    bus.listeners.delete(listener);
  };
}
