import {
  Controller, Post, Get, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'هل ميزة الاستخراج بالذكاء الاصطناعي مُفعّلة؟' })
  status() {
    return { enabled: this.ai.enabled };
  }

  @Post('extract-subject')
  @ApiOperation({ summary: 'استخراج موضوع وملخّص المراسلة من مستندها (PDF/صورة)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async extractSubject(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم تحديد ملف');
    return this.ai.extractSubject(file);
  }
}
