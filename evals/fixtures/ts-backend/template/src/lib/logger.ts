const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
} as const;
type Level = keyof typeof levels;

function currentLevel(): Level {
  const value = process.env.LOG_LEVEL;
  return value && value in levels ? (value as Level) : "info";
}

function write(
  level: Exclude<Level, "silent">,
  message: string,
  fields: Record<string, unknown>,
) {
  if (levels[level] < levels[currentLevel()]) return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields: Record<string, unknown> = {}) =>
    write("debug", message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) =>
    write("info", message, fields),
  warn: (message: string, fields: Record<string, unknown> = {}) =>
    write("warn", message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) =>
    write("error", message, fields),
};
