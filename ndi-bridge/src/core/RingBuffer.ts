export interface RingItem<T> {
  value: T;
  sequence: number;
}

export class RingBuffer<T> {
  private readonly items: Array<RingItem<T> | undefined>;
  private writeIndex = 0;
  private count = 0;
  private sequence = 0;

  constructor(public readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new Error("RingBuffer capacity must be >= 2");
    this.items = new Array(capacity);
  }

  push(value: T): RingItem<T> | undefined {
    const dropped = this.items[this.writeIndex];
    const item = { value, sequence: ++this.sequence };
    this.items[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
    return dropped;
  }

  values(): T[] {
    return this.items.filter((item): item is RingItem<T> => item !== undefined).map(item => item.value);
  }

  get size(): number { return this.count; }
  clear(): void { this.items.fill(undefined); this.count = 0; this.writeIndex = 0; }
}
