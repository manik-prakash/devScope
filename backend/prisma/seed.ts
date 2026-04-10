import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'PRO',
      seats: 10,
    },
  });

  // 2. Manager User
  const managerPassword = await bcrypt.hash('password123', 10);
  const manager = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'manager@acme.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'manager@acme.com',
      name: 'Alice Manager',
      passwordHash: managerPassword,
      role: 'MANAGER',
    },
  });

  // 3. Developer User
  const devPassword = await bcrypt.hash('password123', 10);
  const developer = await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email: 'dev@acme.com' } },
    update: {},
    create: {
      orgId: org.id,
      email: 'dev@acme.com',
      name: 'Bob Developer',
      passwordHash: devPassword,
      role: 'DEVELOPER',
    },
  });

  // 4. Project
  const project = await prisma.project.upsert({
    where: { orgId_slug: { orgId: org.id, slug: 'main-app' } },
    update: {},
    create: {
      orgId: org.id,
      name: 'Main App',
      slug: 'main-app',
    },
  });

  // 5. Project Membership
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: developer.id } },
    update: {},
    create: {
      projectId: project.id,
      userId: developer.id,
      role: 'DEVELOPER',
    },
  });

  // 6. API Key for Developer
  const rawKey = 'dsk_test_key_123456789';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const signingSecret = 'test_signing_secret_00000000';

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      userId: developer.id,
      orgId: org.id,
      keyHash,
      signingSecret,
      label: 'Development Key',
    },
  });

  console.log('✅ Seed complete.');
  console.log(`
  Credentials:
  - Manager: manager@acme.com / password123
  - Developer: dev@acme.com / password123
  - API Key: ${rawKey}
  - Signing Secret: ${signingSecret}
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
