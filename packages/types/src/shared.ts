// Shared types used across frontend components and hooks

export interface ChatMessage {
  id?: string;
  userId: string;
  displayName: string;
  colour: string;
  text: string;
  timestamp: number;
}

export interface Invitation {
  id: string;
  projectName: string;
  inviterName: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface SamplePack {
  id: string;
  name: string;
  samples: { id: string; name: string; fileId?: string }[];
  updatedAt?: string;
}
