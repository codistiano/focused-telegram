const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+/i;

export const extractFirstUrl = (value: string): string | undefined => {
  const match = value.match(URL_PATTERN);
  return match?.[0];
};

export const toTerminalHyperlink = (label: string, url: string): string => `\u001B]8;;${url}\u0007${label}\u001B]8;;\u0007`;
