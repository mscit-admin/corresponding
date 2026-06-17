import {
  Controller, Post, Patch, Delete, Get, Body, Param, Req, UploadedFile, UseInterceptors,
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
  @ApiOperation({ summary: 'حالة الميزة والمزوّدات/الموديلات المتاحة للاختيار' })
  status() {
    return this.ai.status();
  }

  @Get('settings')
  @ApiOperation({ summary: 'قراءة إعدادات الذكاء الاصطناعي وكل المزوّدات (للأدمن)' })
  getSettings(@Req() req: any) {
    ensureAdmin(req);
    return this.ai.getAdminSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'تحديث الإعدادات العامة: التفعيل، نص التوجيه، المزوّد الافتراضي (للأدمن)' })
  updateSettings(
    @Req() req: any,
    @Body() body: { enabled?: boolean; prompt?: string; defaultProviderId?: string },
  ) {
    ensureAdmin(req);
    return this.ai.updateSettings(body || {});
  }

  @Post('providers')
  @ApiOperation({ summary: 'إضافة مزوّد ذكاء اصطناعي يدوياً (للأدمن)' })
  createProvider(@Req() req: any, @Body() body: any) {
    ensureAdmin(req);
    return this.ai.createProvider(body || {});
  }

  @Patch('providers/:id')
  @ApiOperation({ summary: 'تعديل مزوّد (للأدمن)' })
  updateProvider(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    ensureAdmin(req);
    return this.ai.updateProvider(id, body || {});
  }

  @Delete('providers/:id')
  @ApiOperation({ summary: 'حذف مزوّد (للأدمن)' })
  deleteProvider(@Req() req: any, @Param('id') id: string) {
    ensureAdmin(req);
    return this.ai.deleteProvider(id);
  }

  @Post('providers/:id/test')
  @ApiOperation({ summary: 'اختبار اتصال مزوّد (للأدمن)' })
  testProvider(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    ensureAdmin(req);
    return this.ai.testProvider(id, body || {});
  }

  @Post('extract-subject')
  @ApiOperation({ summary: 'استخراج موضوع وملخّص المراسلة من مستندها (PDF/صورة)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        providerId: { type: 'string' },
        model: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async extractSubject(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { providerId?: string; model?: string },
  ) {
    if (!file) throw new BadRequestException('لم يتم تحديد ملف');
    return this.ai.extractSubject(file, { providerId: body?.providerId, model: body?.model });
  }
}
