const RESET = "\u001B[39m";

function paint(color: string, text: string): string {
  const code = Bun.color(color, "ansi");
  return code ? `${code}${text}${RESET}` : text;
}

const SYMBOLS = {
  info: paint("dodgerblue", "ℹ"),
  success: paint("limegreen", "✔"),
  warn: paint("gold", "⚠"),
  error: paint("tomato", "✖"),
} as const;

function info(message: string): void {
  console.log(`${SYMBOLS.info} ${message}`);
}

function success(message: string): void {
  console.log(`${SYMBOLS.success} ${message}`);
}

function warn(message: string): void {
  console.warn(`${SYMBOLS.warn} ${message}`);
}

function error(message: string): void {
  console.error(`${SYMBOLS.error} ${message}`);
}

function title(message: string): void {
  console.log(paint("cyan", message));
}

function log(message: string): void {
  console.log(message);
}

export const logger = { info, success, warn, error, title, log } as const;
