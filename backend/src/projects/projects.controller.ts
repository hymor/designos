import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Req() req: Request) {
    const user = req.user as { userId: number } | undefined;
    if (!user) return { items: [], total: 0 };
    return this.projectsService.listForUser(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateProjectDto) {
    const user = req.user as { userId: number } | undefined;
    if (!user) return this.projectsService.createForUser(0, dto?.name); // dev fallback, should not happen with guard
    return this.projectsService.createForUser(user.userId, dto?.name);
  }
}
