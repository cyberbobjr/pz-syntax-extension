import { ParseResult, ScriptBlock, ScriptValue, Span, blockAt, valueAt } from "../parser/scriptParser";
import { schemaKeyOf } from "../schema/schemaKey";

export interface CursorContext {
  block: ScriptBlock;
  /** Schema key of `block` ("" at module level and outside blocks). */
  key: string;
  /** Start of the statement being typed (after leading whitespace). */
  statementStart: number;
  /** Text of the statement from its start to the cursor. */
  prefix: string;
  inComment: boolean;
  /** Parsed statement under the cursor, if any. */
  value?: ScriptValue;
}

const STATEMENT_DELIMITERS = new Set(["{", "}", ",", "\n"]);

export function isInSpans(offset: number, spans: Span[]): boolean {
  return spans.some((s) => offset > s.start && offset <= s.end);
}

export function cursorContext(text: string, parse: ParseResult, offset: number): CursorContext {
  const block = blockAt(parse.root, offset);
  let start = offset;
  while (start > 0 && !STATEMENT_DELIMITERS.has(parse.clean[start - 1])) start--;
  while (start < offset && /\s/.test(text[start])) start++;
  return {
    block,
    key: schemaKeyOf(block),
    statementStart: start,
    prefix: text.slice(start, offset),
    inComment: isInSpans(offset, parse.comments) || isInSpans(offset, parse.lineComments),
    value: valueAt(block, offset),
  };
}

/** Word made of letters, digits, "_" and "." around `offset`. */
export function wordAt(text: string, offset: number, pattern = /[\w.]/): { text: string; span: Span } | undefined {
  let start = offset;
  let end = offset;
  while (start > 0 && pattern.test(text[start - 1])) start--;
  while (end < text.length && pattern.test(text[end])) end++;
  // A trailing dot is punctuation, not part of the name.
  while (end > start && text[end - 1] === ".") end--;
  while (start < end && text[start] === ".") start++;
  return end > start ? { text: text.slice(start, end), span: { start, end } } : undefined;
}
