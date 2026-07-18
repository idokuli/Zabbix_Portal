const isProd = process.env.NODE_ENV === "production";

export const logger = {
  debug: (..._args: unknown[]) => {
    if (!isProd) {
    }
  },
  info: (..._args: unknown[]) => {
    if (!isProd) {
    }
  },
  warn: (...args: unknown[]) => console.warn("[warn]", ...args),
  error: (...args: unknown[]) => console.error("[error]", ...args),
};
