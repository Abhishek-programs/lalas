import { PrismaClient } from '@prisma/client';
import { singleton } from 'tsyringe';

@singleton()
export class PrismaService {
  public client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  async connect() {
    await this.client.$connect();
  }

  async disconnect() {
    await this.client.$disconnect();
  }
}
