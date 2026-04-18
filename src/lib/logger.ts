/**
 * Fixlo Structured Logger
 * Outputs: [TIMESTAMP] [LEVEL] [CONTEXT] - Message
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function buildPrefix(level: LogLevel, context: string): string {
  return `[${formatTimestamp()}] [${level}] [${context}]`;
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const prefix = buildPrefix(level, context);
  const output = `${prefix} - ${message}`;

  if (data !== undefined) {
    const formatted = JSON.stringify(data, null, 2);
    switch (level) {
      case 'ERROR':
        console.error(output, `\n${formatted}`);
        break;
      case 'WARN':
        console.warn(output, `\n${formatted}`);
        break;
      default:
        console.log(output, `\n${formatted}`);
    }
  } else {
    switch (level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}

export const logger = {
  info: (context: string, message: string, data?: unknown) =>
    log('INFO', context, message, data),

  warn: (context: string, message: string, data?: unknown) =>
    log('WARN', context, message, data),

  error: (context: string, message: string, data?: unknown) =>
    log('ERROR', context, message, data),

  debug: (context: string, message: string, data?: unknown) =>
    log('DEBUG', context, message, data),
};
