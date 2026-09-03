import type { AuthenticatedUser } from "@soulseer/shared";

export type Reader = {
  id: string;
  username: string;
  fullName: string;
  bio: string;
  specialties: string[];
  pricingChat: number;
  pricingVoice: number;
  pricingVideo: number;
  isOnline: boolean;
  lastHeartbeatAt: string | null;
  profileImageKey: string | null;
  rating: number;
  reviewCount: number;
};

export type Review = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  clientName: string;
};

export type MeResponse = {
  user: AuthenticatedUser;
  balance: number;
  reader: Record<string, unknown> | null;
};

export type Reading = {
  id: string;
  type: "chat" | "voice" | "video";
  status: string;
  pricePerMinute: number;
  durationSeconds: number;
  totalPrice: number;
  createdAt?: string;
  startedAt: string | null;
  completedAt: string | null;
  counterpartName?: string;
  clientId?: string;
  readerId?: string;
  rating?: number | null;
  review?: string | null;
};

export type MessageConversation = {
  id: string;
  counterpart: {
    id: string;
    username: string;
    fullName: string;
    profileImageKey: string | null;
  };
  lastMessage: {
    id: string;
    kind: "client_message" | "reader_free" | "reader_paid";
    body: string | null;
    priceCents: number;
    locked: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: "client_message" | "reader_free" | "reader_paid";
  body: string | null;
  priceCents: number;
  locked: boolean;
  unlocked: boolean;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

export type ForumPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  isLocked: boolean;
  createdAt: string;
  authorName: string;
  commentCount: number;
};

export type ForumComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorName: string;
};
