import {
  Controller, Post, Patch, Get, Body, Req, UploadedFile, UseInterceptors,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AiService } from './ai.service';

// الأدمن والأدوار الإشرافية فقط يديرون إعدادات الذكاء الاصطناعي
const ADMIN_ROLES = ['super_admin', 'archive_mgr'];

function ensureAdmin(req: any) {
  const roleName = req.user?.role?.name;
  if (!ADMIN_ROLES.includes(roleName)) {
    throw new ForbiddenException('ليس لديك صلاحية إدارة إعدادات الذكاء الاصطناعي');
  }
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'هل ميزة الاستخراج بالذكاء الاصطناعي مُفعّلة؟' })
  status() {
    return this.ai.status();
  }

  @Get('settings')
  @ApiOperation({ summary: 'قراءة إعدادات الذكاء الاصطناعي (للأدمن)' })
  getSettings(@Req() req: any) {
    ensureAdmin(req);
    return this.ai.getAdminSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'تحديث إعدادات الذكاء الاصطناعي (للأدمن)' })
  updateSettings(
    @Req() req: any,
    @Body() body: { enabled?: boolean; model?: string; prompt?: string; apiKey?: string; clearKey?: boolean },
  ) {
    ensureAdmin(req);
    return this.ai.updateSettings(body || {});
  }

  @Post('settings/test')
  @ApiOperation({ summary: 'اختبار الاتصال بـAnthropic (للأدمن)' })
  testConnection(@Req() req: any, @Body() body: { apiKey?: string }) {
    ensureAdmin(req);
    return this.ai.testConnection(body?.apiKey);
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
