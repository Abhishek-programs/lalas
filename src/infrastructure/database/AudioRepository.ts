import { injectable, inject } from 'tsyringe';
import { PrismaService } from './prisma';
import { IAudioRepository, SearchResult, PaginatedResult } from '../../application/interfaces';
import { Audio } from '../../domain/entities';
import { Prisma } from '@prisma/client';

@injectable()
export class AudioRepository implements IAudioRepository {
  constructor(@inject(PrismaService) private prisma: PrismaService) {}

  private map(data: any): Audio {
    return {
      id: data.id,
      prompt_id: data.prompt_id,
      user_id: data.user_id,
      title: data.title,
      url: data.url,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async findById(id: string): Promise<Audio | null> {
    const audio = await this.prisma.client.audio.findUnique({ where: { id } });
    return audio ? this.map(audio) : null;
  }

  async create(data: Partial<Audio>): Promise<Audio> {
    const audio = await this.prisma.client.audio.create({
      data: {
        prompt_id: data.prompt_id!,
        user_id: data.user_id!,
        title: data.title!,
        url: data.url!,
      }
    });
    return this.map(audio);
  }

  async update(id: string, data: Partial<Audio>): Promise<Audio> {
    const audio = await this.prisma.client.audio.update({
      where: { id },
      data: {
        title: data.title,
      }
    });
    return this.map(audio);
  }

  async findAll(cursor?: string, limit: number = 10): Promise<PaginatedResult<Audio>> {
    const dbLimit = limit + 1;
    const audios = await this.prisma.client.audio.findMany({
      take: dbLimit,
      orderBy: { created_at: 'desc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasNext = audios.length > limit;
    const paginated = hasNext ? audios.slice(0, limit) : audios;
    return {
      data: paginated.map(a => this.map(a)),
      meta: { next_cursor: hasNext ? paginated[paginated.length - 1].id : null }
    };
  }

  async search(query: string, cursor?: string, limit: number = 10): Promise<SearchResult<Audio>> {
    const dbLimit = limit + 1;
    
    const audios: any[] = await this.prisma.client.$queryRaw(Prisma.sql`
      SELECT *, 
        CASE 
          WHEN title = ${query} THEN 2
          WHEN title ILIKE ${'%' + query + '%'} THEN 1
          ELSE 0
        END as rank
      FROM "Audio"
      WHERE title ILIKE ${'%' + query + '%'}
        ${cursor ? Prisma.sql`AND id > ${cursor}` : Prisma.empty}
      ORDER BY rank DESC, id ASC
      LIMIT ${dbLimit}
    `);

    const hasNext = audios.length > limit;
    const paginated = hasNext ? audios.slice(0, limit) : audios;

    return {
      data: paginated.map(a => this.map(a)),
      meta: {
        next_cursor: hasNext ? paginated[paginated.length - 1].id : null
      }
    };
  }
}
