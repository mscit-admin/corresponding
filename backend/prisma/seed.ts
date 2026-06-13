import { PrismaClient, Priority, EntityType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ----- ROLES -----
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: { name: 'super_admin', nameAr: 'مدير النظام', isSystem: true, description: 'Full system access' },
    }),
    prisma.role.upsert({
      where: { name: 'archive_mgr' },
      update: {},
      create: { name: 'archive_mgr', nameAr: 'مدير الأرشيف', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'diwan_officer' },
      update: {},
      create: { name: 'diwan_officer', nameAr: 'موظف الديوان', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'dept_manager' },
      update: {},
      create: { name: 'dept_manager', nameAr: 'رئيس إدارة', isSystem: true },
    }),
    prisma.role.upsert({
      where: { name: 'employee' },
      update: {},
      create: { name: 'employee', nameAr: 'موظف', isSystem: true },
    }),
  ]);
  console.log(`  ✓ ${roles.length} roles created`);

  // ----- PERMISSIONS -----
  const permissionsData = [
    { code: 'correspondence.create', nameAr: 'إنشاء مراسلة', module: 'correspondence', action: 'create' },
    { code: 'correspondence.read', nameAr: 'عرض مراسلة', module: 'correspondence', action: 'read' },
    { code: 'correspondence.update', nameAr: 'تعديل مراسلة', module: 'correspondence', action: 'update' },
    { code: 'correspondence.transfer', nameAr: 'تحويل مراسلة', module: 'correspondence', action: 'transfer' },
    { code: 'correspondence.approve', nameAr: 'اعتماد مراسلة', module: 'correspondence', action: 'approve' },
    { code: 'correspondence.print', nameAr: 'طباعة مراسلة', module: 'correspondence', action: 'print' },
    { code: 'correspondence.archive', nameAr: 'أرشفة مراسلة', module: 'correspondence', action: 'archive' },
    { code: 'users.manage', nameAr: 'إدارة المستخدمين', module: 'admin', action: 'manage' },
    { code: 'reports.view', nameAr: 'عرض التقارير', module: 'reports', action: 'view' },
    { code: 'audit.view', nameAr: 'عرض سجل التدقيق', module: 'audit', action: 'view' },
  ];

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`  ✓ ${permissionsData.length} permissions created`);

  // ----- DEPARTMENTS -----
  const ministry = await prisma.department.upsert({
    where: { code: 'MOA' },
    update: {},
    create: { name: 'وزارة الشؤون الإدارية', code: 'MOA', level: 1 },
  });

  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'MOA-BUD' },
      update: {},
      create: { name: 'إدارة الميزانية', code: 'MOA-BUD', parentId: ministry.id, level: 2 },
    }),
    prisma.department.upsert({
      where: { code: 'MOA-HR' },
      update: {},
      create: { name: 'إدارة الموارد البشرية', code: 'MOA-HR', parentId: ministry.id, level: 2 },
    }),
    prisma.department.upsert({
      where: { code: 'MOA-DIW' },
      update: {},
      create: { name: 'الديوان', code: 'MOA-DIW', parentId: ministry.id, level: 2 },
    }),
  ]);
  console.log(`  ✓ ${departments.length + 1} departments created`);

  // ----- ADMIN USER -----
  const adminRole = roles.find((r) => r.name === 'super_admin')!;
  // 10 rounds keeps login fast on modest servers while staying secure.
  // Configurable via BCRYPT_ROUNDS. update re-hashes existing users so the
  // cost change applies on the next seed run too.
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 10;
  // Set ADMIN_PASSWORD in the environment to use a secret admin password.
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const passwordHash = await bcrypt.hash(adminPassword, rounds);
  const demoHash = await bcrypt.hash('Admin@1234', rounds);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: 'admin',
      email: 'admin@gsdms.local',
      passwordHash,
      fullName: 'System Administrator',
      fullNameAr: 'مدير النظام',
      jobTitle: 'مدير النظام',
      roleId: adminRole.id,
      departmentId: ministry.id,
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user ready (username: admin)`);

  // ----- SAMPLE EMPLOYEE (demo account, password: Admin@1234) -----
  const empRole = roles.find((r) => r.name === 'dept_manager')!;
  await prisma.user.upsert({
    where: { username: 'ahmed.mohamed' },
    update: { passwordHash: demoHash },
    create: {
      username: 'ahmed.mohamed',
      email: 'ahmed.mohamed@gsdms.local',
      passwordHash: demoHash,
      fullName: 'Ahmed Mohamed',
      fullNameAr: 'أحمد محمد',
      jobTitle: 'مدير الميزانية',
      roleId: empRole.id,
      departmentId: departments[0].id,
      isActive: true,
    },
  });
  console.log(`  ✓ Sample employee created (username: ahmed.mohamed, password: Admin@1234)`);

  // ----- EXTERNAL ENTITIES -----
  await Promise.all([
    prisma.externalEntity.upsert({
      where: { id: BigInt(1) },
      update: {},
      create: {
        id: BigInt(1),
        name: 'Ministry of Finance',
        nameAr: 'وزارة المالية',
        type: EntityType.government,
      },
    }),
    prisma.externalEntity.upsert({
      where: { id: BigInt(2) },
      update: {},
      create: {
        id: BigInt(2),
        name: 'Prime Minister Office',
        nameAr: 'ديوان رئاسة الوزراء',
        type: EntityType.government,
      },
    }),
  ]);
  console.log('  ✓ External entities seeded');

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
