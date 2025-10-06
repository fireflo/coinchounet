export type Role = 'player' | 'host' | 'spectator' | 'admin';

export interface AuthenticatedUser {
  userId: string;
  roles: Role[];
}
