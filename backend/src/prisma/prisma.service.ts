import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new Error(
        'PrismaService: DATABASE_URL is required. Set it in .env or environment.',
      );
    }
    const adapter = new PrismaPg({ connectionString: url.trim() });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}

