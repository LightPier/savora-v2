// ─── Per-chat message debounce queue ────────────────────────────────

interface QueueEntry {
  chatId: string;
  chefId: string;
  messages: string[];
  timer: NodeJS.Timeout;
}

export class DebounceQueue {
  private queues = new Map<string, QueueEntry>();
  private onFlush: (chatId: string, chefId: string, messages: string[]) => void;

  constructor(
    onFlush: (chatId: string, chefId: string, messages: string[]) => void
  ) {
    this.onFlush = onFlush;
  }

  enqueue(chatId: string, chefId: string, messageBody: string): void {
    const existing = this.queues.get(chatId);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(messageBody);
      existing.timer = this.startTimer(chatId, existing.messages.length);
    } else {
      const entry: QueueEntry = {
        chatId,
        chefId,
        messages: [messageBody],
        timer: this.startTimer(chatId, 1),
      };
      this.queues.set(chatId, entry);
    }
  }

  pending(): number {
    return this.queues.size;
  }

  private startTimer(chatId: string, messageCount: number): NodeJS.Timeout {
    const ms = Math.min(20_000 + (messageCount - 1) * 15_000, 120_000);
    return setTimeout(() => this.flush(chatId), ms);
  }

  private flush(chatId: string): void {
    const entry = this.queues.get(chatId);
    if (!entry) return;
    this.queues.delete(chatId);
    this.onFlush(entry.chatId, entry.chefId, entry.messages);
  }
}
