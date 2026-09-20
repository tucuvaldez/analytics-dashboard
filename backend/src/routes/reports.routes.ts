import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { authenticate, currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParam, paginationMeta, paginationQuery } from '../utils/pagination.js';

const router = Router();

const generateBody = z.object({
  name: z.string().trim().min(1, 'name is required').max(150),
  // Restrict the report to one dashboard; omit to cover all of the user's dashboards.
  dashboardId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.post(
  '/',
  authenticate,
  validate({ body: generateBody }),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { name, dashboardId, from, to } = req.body as z.infer<typeof generateBody>;
    if (from && to && from > to) throw new ValidationError('Invalid date range', [{ field: 'body.from', message: '"from" must be before "to"' }]);

    // Ownership check: reports only ever aggregate the caller's own dashboards.
    const dashboards = await prisma.dashboard.findMany({
      where: { userId: user.id, ...(dashboardId && { id: dashboardId }) },
      select: { id: true, name: true },
    });
    if (dashboardId && dashboards.length === 0) throw new NotFoundError('Dashboard');

    const grouped = await prisma.dataPoint.groupBy({
      by: ['dashboardId'],
      where: {
        dashboardId: { in: dashboards.map((d) => d.id) },
        ...((from || to) && { timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
      },
      _count: { _all: true },
      _sum: { value: true },
      _avg: { value: true },
      _min: { value: true },
      _max: { value: true },
    });
    const stats = new Map(grouped.map((g) => [g.dashboardId, g]));

    const perDashboard = dashboards.map((d) => {
      const g = stats.get(d.id);
      return {
        dashboardId: d.id,
        name: d.name,
        dataPoints: g?._count._all ?? 0,
        sum: g?._sum.value ?? 0,
        avg: g?._avg.value ?? null,
        min: g?._min.value ?? null,
        max: g?._max.value ?? null,
      };
    });

    const data = {
      period: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      summary: {
        dashboards: perDashboard.length,
        dataPoints: perDashboard.reduce((acc, d) => acc + d.dataPoints, 0),
        totalValue: perDashboard.reduce((acc, d) => acc + d.sum, 0),
      },
      dashboards: perDashboard,
    } satisfies Prisma.InputJsonValue;

    const report = await prisma.report.create({ data: { userId: user.id, name, data } });
    res.status(201).json({ data: report });
  }),
);

router.get(
  '/',
  authenticate,
  validate({ query: paginationQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof paginationQuery>;
    const where = { userId: currentUser(req).id };
    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        orderBy: { generatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: { id: true, name: true, generatedAt: true }, // full `data` via GET /reports/:id
      }),
    ]);
    res.json({ data: reports, meta: paginationMeta(q, total) });
  }),
);

router.get(
  '/:id',
  authenticate,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const report = await prisma.report.findFirst({
      where: { id: req.params.id as string, userId: currentUser(req).id },
    });
    if (!report) throw new NotFoundError('Report');
    res.json({ data: report });
  }),
);

export default router;
