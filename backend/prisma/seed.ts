/**
 * Idempotent development seed. Safe to run repeatedly.
 *
 *   pnpm db:seed
 *
 * Creates one organisation ("Demo Org", slug "demo") with an admin, a developer,
 * one project, and the membership links.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const ADMIN_EMAIL = 'admin@demo.test';
const DEV_EMAIL = 'dev@demo.test';
const PASSWORD = 'demo-password-123';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Org', slug: 'demo', plan: 'FREE', seats: 5 },
  });

  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: ADMIN_EMAIL } },
    update: {},
    create: {
      orgId: org.id,
      email: ADMIN_EMAIL,
      name: 'Demo Admin',
      role: 'ADMIN',
      passwordHash,
      mustChangePass: false,
    },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { ownerId: admin.id },
  });

  const developer = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: DEV_EMAIL } },
    update: {},
    create: {
      orgId: org.id,
      email: DEV_EMAIL,
      name: 'Demo Developer',
      role: 'DEVELOPER',
      passwordHash,
      mustChangePass: false,
    },
  });

  const project = await prisma.project.upsert({
    where: { orgId_slug: { orgId: org.id, slug: 'demo-api' } },
    update: {},
    create: { orgId: org.id, name: 'Demo API', slug: 'demo-api' },
  });

  for (const [userId, role] of [
    [admin.id, 'MANAGER'],
    [developer.id, 'DEVELOPER'],
  ] as const) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: { projectId: project.id, userId, role },
    });
  }

  console.log('Seed complete:');
  console.log(`  org      : ${org.slug}`);
  console.log(`  admin    : ${ADMIN_EMAIL} / ${PASSWORD}`);
  console.log(`  developer: ${DEV_EMAIL} / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
