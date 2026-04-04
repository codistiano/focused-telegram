export interface WhitelistedItem {
  id: number | string;
  name: string;
  type: 'chat' | 'channel' | 'group';
  username?: string;
  displayType?: string;
}

export interface Message {
  id: number;
  text?: string;
  sender?: string;
  date: Date;
  isOutgoing: boolean;
  mediaType?: string;
  fileName?: string;
  messageObj?: any;
}