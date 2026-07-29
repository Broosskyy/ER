/**
 * Graceful shutdown coordination for worker processes.
 * Registers SIGTERM/SIGINT handlers to pause worker before exit.
 */
import { operationsControlService } from '@/data/repositories/registry';

let shuttingDown = false;

export async function registerGracefulShutdownHandlers(): Promise<void> {
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      await operationsControlService.pauseWorker();
      console.log(`Graceful shutdown: worker paused (${signal}).`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Graceful shutdown failed: ${message}`);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
