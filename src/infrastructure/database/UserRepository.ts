import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma';
import { IUserRepository, SearchResult } from '../../application/interfaces';
import { User, SubscriptionStatus } from '../../domain/entities';
import { Prisma } from '@prisma/client';

@injectable()
export class UserRepository implements IUserRepository {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  private map(data: any): User {
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      display_name: data.display_name,
      refresh_token: data.refresh_token,
      subscription_status: data.subscription_status as SubscriptionStatus,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    return user ? this.map(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    return user ? this.map(user) : null;
  }

  async create(data: Partial<User>): Promise<User> {
    const user = await this.prisma.client.user.create({
      data: {
        email: data.email!,
        password: data.password!,
        display_name: data.display_name!,
      }
    });
    return this.map(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.prisma.client.user.update({
      where: { id },
      data: {
        display_name: data.display_name,
        subscription_status: data.subscription_status,
      }
    });
    return this.map(user);
  }

  async updateRefreshToken(id: string, token: string | null): Promise<void> {
    await this.prisma.client.user.update({
      where: { id },
      data: { refresh_token: token }
    });
  }

  async findAll(cursor?: string, limit: number = 10): Promise<SearchResult<User>> {
    const dbLimit = limit + 1;
    const users = await this.prisma.client.user.findMany({
      take: dbLimit,
      orderBy: { created_at: 'desc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasNext = users.length > limit;
    const paginated = hasNext ? users.slice(0, limit) : users;
    return {
      data: paginated.map(u => this.map(u)),
      meta: { next_cursor: hasNext ? paginated[paginated.length - 1].id : null }
    };
  }

  async search(query: string, cursor?: string, limit: number = 10): Promise<SearchResult<User>> {
    // Weighted search using raw SQL to sort by exact match first, then partial match
    const dbLimit = limit + 1; // Fetch one extra to determine next_cursor
    
    const users: any[] = await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT *, 
        CASE 
          WHEN email = ${query} OR display_name = ${query} THEN 2
          WHEN email ILIKE ${'%' + query + '%'} OR display_name ILIKE ${'%' + query + '%'} THEN 1
          ELSE 0
        END as rank
      FROM "User"
      WHERE (email ILIKE ${'%' + query + '%'} OR display_name ILIKE ${'%' + query + '%'})
        ${cursor ? Prisma.sql`AND id > ${cursor}` : Prisma.empty}
      ORDER BY rank DESC, id ASC
      LIMIT ${dbLimit}
    `);

    const hasNext = users.length > limit;
    const paginatedUsers = hasNext ? users.slice(0, limit) : users;

    return {
      data: paginatedUsers.map(u => this.map(u)),
      meta: {
        next_cursor: hasNext ? paginatedUsers[paginatedUsers.length - 1].id : null
      }
    };
  }
}
