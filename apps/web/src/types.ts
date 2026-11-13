import type { Mode, Move } from '@rps/crypto-core';

export type User = { id: string; username: string };
export type Tournament = {
  id: string;
  name: string;
  capacity: 2 | 4 | 8;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETE' | 'BLOCKED';
  created_at: string;
};
export type Participant = { user_id: string; slot: number; username: string };
export type BracketMatch = {
  id: string;
  tournament_id: string;
  player_a_id: string;
  player_b_id: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ABANDONED';
  stage: number;
  position: number;
  wins_required: number;
  winner_user_id: string | null;
  created_at: string;
};
export type TournamentDetail = {
  tournament: Tournament;
  participants: Participant[];
  matches: BracketMatch[];
};
export type Round = {
  id: string;
  match_id: string;
  round_no: number;
  status: 'COMMIT' | 'REVEAL' | 'RESOLVED';
  commit_deadline: string;
  reveal_deadline: string | null;
  winner_user_id: string | null;
  created_at: string;
};
export type Commitment = {
  user_id: string;
  key_id: string;
  mode: Mode;
  commitment: string;
  signature: string;
};
export type Reveal = {
  user_id: string;
  move: Move;
  blinding_factor: string;
  valid: number;
};
export type MatchDetail = {
  match: BracketMatch;
  round: Round;
  rounds: Pick<Round, 'round_no' | 'status' | 'winner_user_id'>[];
  score: Record<string, number>;
  commitments: Commitment[];
  revealedUserIds: string[];
  reveals?: Reveal[];
};
export type StoredPublicKey = {
  id: string;
  user_id?: string;
  jwk: string;
  created_at: string;
  revoked_at: string | null;
};
export type AuditEvent = {
  seq: number;
  prev_hash: string;
  hash: string;
  event_type: string;
  event_json: string;
  created_at: string;
};
