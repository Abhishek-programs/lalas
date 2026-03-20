export enum SubscriptionStatus {
  FREE = 'FREE',
  PAID = 'PAID'
}

export enum PromptStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  email: string;
  password?: string;
  display_name: string;
  refresh_token?: string | null;
  subscription_status: SubscriptionStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Prompt {
  id: string;
  user_id: string;
  text: string;
  status: PromptStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Audio {
  id: string;
  prompt_id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: Date;
  updated_at: Date;
}
