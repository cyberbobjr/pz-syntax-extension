import { ParseResult, Span, parseScript } from "../parser/scriptParser";

// Re-indents a script from its brace depth and normalizes `key = value` lines.
// Only whitespace changes: statements, values and comments are kept as written.

export interface FormatOptions {
  /** One indentation level, e.g. "    " or "\t". */
  indent: string;
  /** Align the "=" of consecutive property lines. */
  alignValues: boolean;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = { indent: "    ", alignValues: true };

/** A single `key = value` statement on its own line, without comment nor brace. */
const PROPERTY_LINE = /^([^\s=,{}][^=,{}]*?)\s*=\s*([^,{}]*?)\s*(,?)$/;

interface Line {
  text: string;
  clean: string;
  start: number;
}

interface PropertyLine {
  index: number;
  depth: number;
  key: string;
  value: string;
  comma: string;
}

function splitLines(text: string, clean: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (const raw of text.split("\n")) {
    const withoutCr = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    lines.push({ text: withoutCr, clean: clean.slice(start, start + withoutCr.length), start });
    start += raw.length + 1;
  }
  return lines;
}

function isInside(offset: number, spans: Span[]): boolean {
  return spans.some((s) => offset > s.start && offset < s.end);
}

/** Brace depth at the start of each line (from comment-free text). */
function lineDepths(lines: Line[]): number[] {
  let depth = 0;
  return lines.map((line) => {
    const atStart = depth;
    for (const c of line.clean) {
      if (c === "{") depth++;
      else if (c === "}") depth = Math.max(0, depth - 1);
    }
    return atStart;
  });
}

function alignRun(run: PropertyLine[], out: string[], options: FormatOptions): void {
  const width = options.alignValues ? Math.max(...run.map((p) => p.key.length)) : 0;
  for (const p of run) {
    const key = options.alignValues ? p.key.padEnd(width) : p.key;
    out[p.index] = `${options.indent.repeat(p.depth)}${key} = ${p.value}${p.comma}`.trimEnd();
  }
}

export function formatScript(text: string, options: FormatOptions = DEFAULT_FORMAT_OPTIONS, parsed?: ParseResult): string {
  const parse = parsed ?? parseScript(text);
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = splitLines(text, parse.clean);
  const depths = lineDepths(lines);
  const out: string[] = [];
  let run: PropertyLine[] = [];
  const flush = (): void => {
    if (run.length) alignRun(run, out, options);
    run = [];
  };

  lines.forEach((line, index) => {
    if (isInside(line.start, parse.comments)) {
      // Continuation of a multi-line comment: left untouched.
      flush();
      out.push(line.text);
      return;
    }
    const trimmed = line.text.trim();
    const cleanTrimmed = line.clean.trim();
    const depth = Math.max(0, depths[index] - (cleanTrimmed.startsWith("}") ? 1 : 0));
    const match = trimmed === cleanTrimmed ? PROPERTY_LINE.exec(trimmed) : null;
    if (match) {
      if (run.length && run[0].depth !== depth) flush();
      out.push("");
      run.push({ index, depth, key: match[1], value: match[2], comma: match[3] });
      return;
    }
    flush();
    out.push(trimmed ? `${options.indent.repeat(depth)}${trimmed}` : "");
  });
  flush();
  return out.join(eol);
}
