type LogContext = Record<string, unknown>;

const logger = {
  debug(message: string, context?: LogContext): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, context ?? "");
    }
  },
  info(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${message}`, context ?? "");
  },
  warn(message: string, context?: LogContext): void {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${message}`, context ?? "");
  },
  error(message: string, error?: unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? "");
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, errorMessage);
  },
};

export default logger;
