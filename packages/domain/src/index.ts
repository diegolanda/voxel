export const MVP_THEMES = ["forest", "snow", "coast"] as const;
export type MvpTheme = (typeof MVP_THEMES)[number];

export const MAX_PLAYERS_PER_ROOM = 5;
export const MAX_WORLDS_PER_ACCOUNT = 3;
export const ROOM_NAME_MIN_LENGTH = 3;
export const ROOM_NAME_MAX_LENGTH = 64;
export const PROFILE_DISPLAY_NAME_MIN_LENGTH = 2;
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 40;

export type RoomStatus = "lobby" | "active" | "closed";
export type RoomMemberRole = "host" | "guest";

export interface RoomIdentity {
  roomId: string;
  inviteToken: string;
}

export interface Profile {
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface RoomSummary {
  id: string;
  hostId: string;
  name: string;
  theme: MvpTheme;
  seed: string;
  inviteToken: string;
  status: RoomStatus;
  maxPlayers: number;
  createdAt: string;
}

export function isMvpTheme(value: string): value is MvpTheme {
  return (MVP_THEMES as readonly string[]).includes(value);
}
