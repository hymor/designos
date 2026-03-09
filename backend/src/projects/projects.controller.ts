import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectsController {
  @Get()
  list() {
    return { items: [], total: 0 };
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return {
      id: `p-${Date.now()}`,
      name: dto.name ?? 'Untitled',
    };
  }
}
