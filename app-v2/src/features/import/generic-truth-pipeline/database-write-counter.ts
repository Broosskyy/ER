export class DatabaseWriteCounter {
  private count = 0;
  private readonly operations: string[] = [];

  record(operation: string): void {
    this.count += 1;
    this.operations.push(operation);
  }

  get totalDatabaseWrites(): number {
    return this.count;
  }

  get recordedOperations(): readonly string[] {
    return this.operations;
  }

  reset(): void {
    this.count = 0;
    this.operations.length = 0;
  }
}

export const globalDatabaseWriteCounter = new DatabaseWriteCounter();
