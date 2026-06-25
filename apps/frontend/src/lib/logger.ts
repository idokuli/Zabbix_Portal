const isProd = process.env.NODE_ENV === "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (!isProd) console.debug("[debug]", ...args);
  },
  info: (...args: unknown[]) => {
    if (!isProd) console.info("[info]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[warn]", ...args),
  error: (...args: unknown[]) => console.error("[error]", ...args),
};
