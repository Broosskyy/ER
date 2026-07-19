import { importConfig } from '@/features/import/config/import-config';
import type { CreateImportLogInput } from '@/features/import/models/types';
import type { ImportLogLevel } from '@/features/import/models/statuses';
import type { ImportLogRepository } from '@/data/repositories/import-repositories';

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /bearer\s+/i,
];

function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized;
}

export class ImportLoggingService {
  constructor(private readonly logRepository: ImportLogRepository) {}

  private async write(
    level: ImportLogLevel,
    code: string,
    message: string,
    importJobId: string,
    importRecordId?: string,
  ): Promise<void> {
    if (!importConfig.loggingEnabled) {
      return;
    }

    const input: CreateImportLogInput = {
      importJobId,
      importRecordId,
      level,
      code,
      message: sanitizeMessage(message),
    };
    await this.logRepository.create(input);
  }

  async debug(
    importJobId: string,
    code: string,
    message: string,
    importRecordId?: string,
  ): Promise<void> {
    await this.write('debug', code, message, importJobId, importRecordId);
  }

  async info(
    importJobId: string,
    code: string,
    message: string,
    importRecordId?: string,
  ): Promise<void> {
    await this.write('info', code, message, importJobId, importRecordId);
  }

  async warning(
    importJobId: string,
    code: string,
    message: string,
    importRecordId?: string,
  ): Promise<void> {
    await this.write('warning', code, message, importJobId, importRecordId);
  }

  async error(
    importJobId: string,
    code: string,
    message: string,
    importRecordId?: string,
  ): Promise<void> {
    await this.write('error', code, message, importJobId, importRecordId);
  }
}
