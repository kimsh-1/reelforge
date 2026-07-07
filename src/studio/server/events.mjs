export class StudioEventHub {
  constructor() {
    this.clients = new Set();
    this.nextId = 1;
    this.debounceTimers = new Map();
  }

  connect(req, res) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    res.write(": connected\n\n");
    this.clients.add(res);
    req.on("close", () => {
      this.clients.delete(res);
    });
  }

  emit(event, data = {}) {
    const payload = [
      `id: ${this.nextId++}`,
      `event: ${event}`,
      `data: ${JSON.stringify(data)}`,
      "",
      ""
    ].join("\n");
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  emitDebounced(key, event, data = {}, delayMs = 75) {
    if (this.debounceTimers.has(key)) clearTimeout(this.debounceTimers.get(key));
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.emit(event, data);
    }, delayMs);
    this.debounceTimers.set(key, timer);
  }

  close() {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
  }
}
