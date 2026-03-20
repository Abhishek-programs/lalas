import { User, Prompt, Audio, PromptStatus } from '../domain/entities';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    next_cursor: string | null;
    total?: number;
  };
}

// Re-export as SearchResult alias for convenience
export type SearchResult<T> = PaginatedResult<T>;

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(cursor?: string, limit?: number): Promise<PaginatedResult<User>>;
  create(data: Partial<User>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  updateRefreshToken(id: string, token: string | null): Promise<void>;
  search(query: string, cursor?: string, limit?: number): Promise<SearchResult<User>>;
}

export interface IPromptRepository {
  findById(id: string): Promise<Prompt | null>;
  create(data: Partial<Prompt>): Promise<Prompt>;
  updateStatus(id: string, status: PromptStatus): Promise<Prompt>;
  getPendingPrompts(limit: number): Promise<Prompt[]>;
}

export interface IAudioRepository {
  findById(id: string): Promise<Audio | null>;
  findAll(cursor?: string, limit?: number): Promise<PaginatedResult<Audio>>;
  create(data: Partial<Audio>): Promise<Audio>;
  update(id: string, data: Partial<Audio>): Promise<Audio>;
  search(query: string, cursor?: string, limit?: number): Promise<SearchResult<Audio>>;
}

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  increment(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}
