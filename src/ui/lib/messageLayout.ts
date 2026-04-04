import { MessageSummary } from '../../client';

export interface WrappedMessage {
  message: MessageSummary;
  isCursor: boolean;
  header: string;
  bodyLines: string[];
  totalLines: number;
}

const normalizeLine = (line: string): string => (line.length > 0 ? line : ' ');

const wrapLine = (line: string, width: number): string[] => {
  if (width <= 1) return [normalizeLine(line)];
  if (line.length === 0) return [' '];

  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > width) {
    const slice = remaining.slice(0, width);
    const breakAt = slice.lastIndexOf(' ');

    if (breakAt > Math.floor(width / 3)) {
      chunks.push(slice.slice(0, breakAt).trimEnd() || ' ');
      remaining = remaining.slice(breakAt + 1).trimStart();
    } else {
      chunks.push(slice);
      remaining = remaining.slice(width);
    }
  }

  chunks.push(normalizeLine(remaining));
  return chunks;
};

export const wrapMessageBody = (text: string, width: number): string[] =>
  text.split(/\r?\n/).flatMap((line) => wrapLine(line, width));

export const getMessagePaneWidth = (terminalColumns: number, chatPaneWidth: number): number =>
  Math.max(28, terminalColumns - chatPaneWidth - 9);

export const getMessageLineBudget = (terminalRows: number): number => Math.max(8, terminalRows - 14);

export const buildVisibleMessages = (
  messages: MessageSummary[],
  messageCursor: number,
  bodyWidth: number,
  lineBudget: number,
  formatHeader: (message: MessageSummary) => string
): WrappedMessage[] => {
  if (messages.length === 0) return [];

  const safeCursor = Math.min(Math.max(messageCursor, 0), messages.length - 1);
  const wrapped = messages.map((message, index) => {
    const bodyLines = wrapMessageBody(message.text, Math.max(8, bodyWidth));
    return {
      message,
      isCursor: index === safeCursor,
      header: formatHeader(message),
      bodyLines,
      totalLines: 1 + bodyLines.length + 1,
    };
  });

  let start = safeCursor;
  let end = safeCursor + 1;
  let usedLines = wrapped[safeCursor].totalLines;

  while (start > 0 && usedLines + wrapped[start - 1].totalLines <= lineBudget) {
    start -= 1;
    usedLines += wrapped[start].totalLines;
  }

  while (end < wrapped.length && usedLines + wrapped[end].totalLines <= lineBudget) {
    usedLines += wrapped[end].totalLines;
    end += 1;
  }

  return wrapped.slice(start, end);
};
