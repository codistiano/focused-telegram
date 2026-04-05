export const getMessageStorageKey = (dialogId: string, messageId: number): string => `${dialogId}:${messageId}`;
