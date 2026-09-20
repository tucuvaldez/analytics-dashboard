import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin1234!'; // dev-only credentials, printed below so you can log in

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the dev seed (fixed admin password) in production');
  }

  // Idempotent: wipe the previous seeded admin (cascades to their dashboards/data/reports/tokens).
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });

  const admin = await prisma.user.create({
    data: { email: ADMIN_EMAIL, password: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'ADMIN' },
  });

  const sales = await prisma.dashboard.create({
    data: {
      userId: admin.id,
      name: 'Sales Overview',
      description: 'Daily revenue (USD) for the last 14 days',
      isPublic: true,
    },
  });

  const traffic = await prisma.dashboard.create({
    data: {
      userId: admin.id,
      name: 'Website Traffic',
      description: 'Daily unique visitors for the last 14 days',
      isPublic: false,
    },
  });

  const now = Date.now();
  const series = (days: number, base: number, spread: number) =>
    Array.from({ length: days }, (_, i) => {
      // Deterministic pseudo-variation so reruns give the same shape.
      const wave = Math.sin(i / 2) * spread;
      const trend = i * (spread / 6);
      return { offset: days - 1 - i, value: Math.round((base + wave + trend) * 100) / 100 };
    });

  await prisma.dataPoint.createMany({
    data: [
      ...series(14, 1200, 250).map(({ offset, value }) => ({
        dashboardId: sales.id,
        label: 'Daily revenue',
        value,
        timestamp: new Date(now - offset * DAY),
      })),
      ...series(14, 3400, 600).map(({ offset, value }) => ({
        dashboardId: traffic.id,
        label: 'Unique visitors',
        value,
        timestamp: new Date(now - offset * DAY),
      })),
    ],
  });

  console.log('✅ Seed completed');
  console.log(`   Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   Dashboards:  ${sales.name} (public), ${traffic.name} (private)`);
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
