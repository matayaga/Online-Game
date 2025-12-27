
export type ResourceType = 'water' | 'green' | 'material';

export interface ResourceSet {
  water: number;
  green: number;
  material: number;
}

export interface ZoneConfig {
  id: string;
  name: string;
  color: string;
  initial: ResourceSet;
  production: Partial<ResourceSet>;
  desc: string;
}

export interface Card {
  id: string;
  uuid: string;
  type: 'build' | 'adaptation' | 'action';
  name: string;
  cost: Partial<ResourceSet>;
  score: number;
  resilience: number;
  hp: number;
  maxHp: number;
  desc: string;
  effect?: string;
}

export interface Player {
  id: string;
  name: string;
  isAi: boolean;
  color: string;
  zone: string;
  resources: ResourceSet;
  score: number;
  buildings: Card[];
}

export interface GameLog {
  msg: string;
  time: number;
  type: 'system' | 'action' | 'event' | 'ai';
}

export interface GameState {
  status: 'lobby' | 'playing' | 'finished';
  roomId: string;
  players: Player[];
  turnIndex: number;
  turnPhase: number; // 2: Interaction, 3: Build
  roundCount: number;
  turnTotal: number;
  winner: string | null;
  globalTemp: number;
  market: Card[];
  deck: Card[];
  logs: GameLog[];
}

export enum InteractionMode {
  PLUNDER = 'plunder',
  BANK_TRADE = 'bank_trade',
  PLAYER_TRADE = 'player_trade'
}
