// Parser for Project Zomboid script files, faithful to the game's zombie.scripting.ScriptParser:
//   - only /* ... */ are comments (the game has no line comments)
//   - "{" opens a block whose header is the text since the previous "{", "}" or ","
//   - "," and "}" end a value; a value is "key = value" or a bare statement
// Every node keeps offsets into the original text so editor features can map back to it.

export interface Span {
  start: number;
  end: number;
}

export interface ScriptValue {
  kind: "value";
  /** Whole statement, trimmed. */
  text: string;
  span: Span;
  key?: string;
  keySpan?: Span;
  separator?: "=" | ":";
  /** Text after the separator, trimmed (may be empty: `outfit = ,`). */
  value?: string;
  valueSpan?: Span;
  /** True when the statement is followed by a comma. */
  terminated: boolean;
  parent: ScriptBlock;
}

export interface ScriptBlock {
  kind: "block";
  /** Block type, e.g. `item`, `craftRecipe`, `component`. Empty for the root. */
  type: string;
  /** Block identifier, e.g. `Hammer` or `Fix Pistol`. May be empty. */
  name: string;
  typeSpan: Span;
  nameSpan?: Span;
  headerSpan: Span;
  /** Offset of "{" (-1 for the root). */
  openBrace: number;
  /** Offset of "}", undefined when the block is never closed. */
  closeBrace?: number;
  children: ScriptNode[];
  parent?: ScriptBlock;
}

export type ScriptNode = ScriptBlock | ScriptValue;

export type IssueCode =
  | "unexpected-close"
  | "unclosed-block"
  | "missing-comma"
  | "line-comment"
  | "unterminated-comment"
  | "text-outside-block"
  | "empty-header";

export interface ParseIssue {
  code: IssueCode;
  message: string;
  span: Span;
  severity: "error" | "warning";
}

export interface ParseResult {
  root: ScriptBlock;
  /** Block comments and (invalid) line comments. */
  comments: Span[];
  lineComments: Span[];
  issues: ParseIssue[];
  /** Source with every comment replaced by spaces (same length and line breaks). */
  clean: string;
}

const COLON_SEPARATOR_BLOCKS = new Set(["fixing", "recipe"]);

interface Blanked {
  clean: string;
  comments: Span[];
  lineComments: Span[];
  issues: ParseIssue[];
}

function blank(text: string, start: number, end: number): string {
  return text.slice(start, end).replace(/[^\r\n]/g, " ");
}

/** Replaces comments with spaces; `//` comments are reported because the game does not support them. */
function blankComments(text: string): Blanked {
  const comments: Span[] = [];
  const lineComments: Span[] = [];
  const issues: ParseIssue[] = [];
  let clean = "";
  let copied = 0;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("/*", i)) {
      const close = matchingCommentEnd(text, i);
      const end = close === -1 ? text.length : close + 2;
      if (close === -1) {
        issues.push({ code: "unterminated-comment", message: "Unterminated comment: missing */", span: { start: i, end: i + 2 }, severity: "error" });
      }
      comments.push({ start: i, end });
      clean += text.slice(copied, i) + blank(text, i, end);
      copied = end;
      i = end;
    } else if (text.startsWith("//", i) && isLineCommentStart(text, i)) {
      const newline = text.indexOf("\n", i);
      const end = newline === -1 ? text.length : newline;
      lineComments.push({ start: i, end });
      issues.push({
        code: "line-comment",
        message: "Project Zomboid does not support // comments: the game reads this text as script. Use /* ... */ instead.",
        span: { start: i, end },
        severity: "error",
      });
      clean += text.slice(copied, i) + blank(text, i, end);
      copied = end;
      i = end;
    } else {
      i++;
    }
  }
  clean += text.slice(copied);
  return { clean, comments, lineComments, issues };
}

/**
 * Offset of the "*\/" closing the comment opened at `start`, or -1. Comments nest like in the game:
 * `/* a /* b *\/ c *\/` is one comment (mods rely on it to comment out blocks that contain comments).
 */
function matchingCommentEnd(text: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < text.length - 1) {
    if (text[i] === "/" && text[i + 1] === "*") {
      depth++;
      i += 2;
    } else if (text[i] === "*" && text[i + 1] === "/") {
      depth--;
      if (depth === 0) return i;
      i += 2;
    } else {
      i++;
    }
  }
  return -1;
}

/** `//` counts as a comment only at the start of a line or after a delimiter, not inside paths like `a//b`. */
function isLineCommentStart(text: string, index: number): boolean {
  for (let j = index - 1; j >= 0; j--) {
    const c = text[j];
    if (c === "\n") return true;
    if (c === " " || c === "\t" || c === "\r") continue;
    return c === "," || c === "{" || c === "}";
  }
  return true;
}

function trimSpan(text: string, start: number, end: number): Span {
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return { start: s, end: e };
}

function isBlank(text: string, start: number, end: number): boolean {
  return trimSpan(text, start, end).start === trimSpan(text, start, end).end;
}

/** Non-empty trimmed lines of a span. */
function lineSpans(text: string, span: Span): Span[] {
  const spans: Span[] = [];
  let lineStart = span.start;
  for (let i = span.start; i <= span.end; i++) {
    if (i === span.end || text[i] === "\n") {
      const line = trimSpan(text, lineStart, i);
      if (line.end > line.start) spans.push(line);
      lineStart = i + 1;
    }
  }
  return spans;
}

class Parser {
  private readonly issues: ParseIssue[] = [];
  private readonly root: ScriptBlock;
  private readonly stack: ScriptBlock[];

  constructor(private readonly text: string) {
    this.root = { kind: "block", type: "", name: "", typeSpan: { start: 0, end: 0 }, headerSpan: { start: 0, end: 0 }, openBrace: -1, children: [] };
    this.stack = [this.root];
  }

  parse(): { root: ScriptBlock; issues: ParseIssue[] } {
    const text = this.text;
    let segmentStart = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "{") {
        this.openBlock(segmentStart, i);
        segmentStart = i + 1;
      } else if (c === "}") {
        this.addValues(segmentStart, i, false);
        this.closeBlock(i);
        segmentStart = i + 1;
      } else if (c === ",") {
        this.addValues(segmentStart, i, true);
        segmentStart = i + 1;
      }
    }
    this.addValues(segmentStart, text.length, false);
    for (const block of this.stack.slice(1)) {
      this.issues.push({ code: "unclosed-block", message: `Missing "}" to close ${describe(block)}`, span: block.headerSpan.end > block.headerSpan.start ? block.headerSpan : { start: block.openBrace, end: block.openBrace + 1 }, severity: "error" });
    }
    return { root: this.root, issues: this.issues };
  }

  private get current(): ScriptBlock {
    return this.stack[this.stack.length - 1];
  }

  private openBlock(segmentStart: number, bracePos: number): void {
    const parent = this.current;
    const lines = lineSpans(this.text, { start: segmentStart, end: bracePos });
    if (lines.length > 1) {
      // Text before the header on other lines: the game would glue it into the header.
      this.addValueLines(lines.slice(0, -1), parent, false, true);
    }
    const header = lines.length ? lines[lines.length - 1] : { start: bracePos, end: bracePos };
    const headerText = this.text.slice(header.start, header.end);
    const firstSpace = headerText.search(/\s/);
    const typeEnd = firstSpace === -1 ? header.end : header.start + firstSpace;
    const nameSpan = firstSpace === -1 ? undefined : trimSpan(this.text, typeEnd, header.end);
    const block: ScriptBlock = {
      kind: "block",
      type: this.text.slice(header.start, typeEnd),
      name: nameSpan ? this.text.slice(nameSpan.start, nameSpan.end) : "",
      typeSpan: { start: header.start, end: typeEnd },
      nameSpan,
      headerSpan: header,
      openBrace: bracePos,
      children: [],
      parent,
    };
    if (!block.type) {
      this.issues.push({ code: "empty-header", message: "Block without a type: add a header such as `item MyItem` before \"{\"", span: { start: bracePos, end: bracePos + 1 }, severity: "warning" });
    }
    parent.children.push(block);
    this.stack.push(block);
  }

  private closeBlock(bracePos: number): void {
    if (this.stack.length === 1) {
      this.issues.push({ code: "unexpected-close", message: 'Unexpected "}": no block to close', span: { start: bracePos, end: bracePos + 1 }, severity: "error" });
      return;
    }
    const block = this.stack.pop()!;
    block.closeBrace = bracePos;
  }

  private addValues(start: number, end: number, terminated: boolean): void {
    if (isBlank(this.text, start, end)) return;
    const lines = lineSpans(this.text, { start, end });
    this.addValueLines(lines, this.current, terminated);
  }

  /**
   * Several statements on consecutive lines without commas are split back, one per line, and flagged.
   * `beforeHeader`: the lines precede a block header, so even the last one lacks its comma.
   */
  private addValueLines(lines: Span[], parent: ScriptBlock, lastTerminated: boolean, beforeHeader = false): void {
    lines.forEach((line, index) => {
      const isLast = index === lines.length - 1;
      if (!isLast || beforeHeader) {
        this.issues.push({ code: "missing-comma", message: "Missing comma: the game merges this line with the next one", span: { start: line.end, end: line.end }, severity: "error" });
      }
      const value = this.createValue(line, parent, isLast ? lastTerminated : false);
      if (parent === this.root) {
        this.issues.push({ code: "text-outside-block", message: "Text outside of any block is ignored by the game", span: line, severity: "warning" });
      }
      parent.children.push(value);
    });
  }

  private createValue(span: Span, parent: ScriptBlock, terminated: boolean): ScriptValue {
    const text = this.text.slice(span.start, span.end);
    const value: ScriptValue = { kind: "value", text, span, terminated, parent };
    let sepIndex = text.indexOf("=");
    let separator: "=" | ":" | undefined = sepIndex === -1 ? undefined : "=";
    if (separator === undefined && COLON_SEPARATOR_BLOCKS.has(parent.type.toLowerCase())) {
      const colon = /^[A-Za-z_][\w.]*\s*:/.exec(text);
      if (colon) {
        sepIndex = colon[0].length - 1;
        separator = ":";
      }
    }
    if (separator !== undefined) {
      const keySpan = trimSpan(this.text, span.start, span.start + sepIndex);
      const valueSpan = trimSpan(this.text, span.start + sepIndex + 1, span.end);
      value.separator = separator;
      value.key = this.text.slice(keySpan.start, keySpan.end);
      value.keySpan = keySpan;
      value.value = this.text.slice(valueSpan.start, valueSpan.end);
      value.valueSpan = valueSpan;
    }
    return value;
  }
}

function describe(block: ScriptBlock): string {
  return block.name ? `${block.type} ${block.name}` : block.type || "block";
}

export function parseScript(text: string): ParseResult {
  const blanked = blankComments(text);
  const { root, issues } = new Parser(blanked.clean).parse();
  return {
    root,
    comments: blanked.comments,
    lineComments: blanked.lineComments,
    issues: [...blanked.issues, ...issues].sort((a, b) => a.span.start - b.span.start),
    clean: blanked.clean,
  };
}

export function isBlock(node: ScriptNode): node is ScriptBlock {
  return node.kind === "block";
}

export function isValue(node: ScriptNode): node is ScriptValue {
  return node.kind === "value";
}

/** Blocks from the outermost (below root) to `block` itself. */
export function blockChain(block: ScriptBlock): ScriptBlock[] {
  const chain: ScriptBlock[] = [];
  for (let b: ScriptBlock | undefined = block; b && b.openBrace !== -1; b = b.parent) {
    chain.unshift(b);
  }
  return chain;
}

/** Depth-first walk over every block (root excluded). */
export function* walkBlocks(block: ScriptBlock): Generator<ScriptBlock> {
  for (const child of block.children) {
    if (isBlock(child)) {
      yield child;
      yield* walkBlocks(child);
    }
  }
}

/** Innermost block whose braces contain `offset` (root when outside every block). */
export function blockAt(root: ScriptBlock, offset: number): ScriptBlock {
  for (const child of root.children) {
    if (!isBlock(child)) continue;
    const end = child.closeBrace ?? Number.POSITIVE_INFINITY;
    if (offset > child.openBrace && offset <= end) {
      return blockAt(child, offset);
    }
  }
  return root;
}

/** Statement of `block` whose span contains `offset`, if any. */
export function valueAt(block: ScriptBlock, offset: number): ScriptValue | undefined {
  return block.children.find((c): c is ScriptValue => isValue(c) && offset >= c.span.start && offset <= c.span.end);
}
