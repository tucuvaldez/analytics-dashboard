import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AuthorizationError, NotFoundError } from '../errors/AppError.js';
import { authenticate, currentUser, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { idParam, paginationMeta, paginationQuery } from '../utils/pagination.js';

const router = Router();

const name = z.string().trim().min(1, 'name is required').max(100);
const description = z.string().trim().max(500).nullable();

const createBody = z.object({
  name,
  description: description.optional(),
  isPublic: z.boolean().default(false),
});

const updateBody = z
  .object({ name: name.optional(), description: description.optional(), isPublic: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const listQuery = paginationQuery.extend({
  // "mine" = dashboards I own, "public" = public dashboards from anyone
  scope: z.enum(['mine', 'public']).default('mine'),
});

const dataPointInput = z.object({
  label: z.string().trim().min(1, 'label is required').max(100),
  value: z.number().finite('value must be a finite number'),
  timestamp: z.coerce.date().optional(),
});
// Accepts a single data point or an array (bulk insert, max 1000).
// A single object is wrapped into an array first so validation errors point at the exact field
// (e.g. "body.0.value") instead of a generic "Invalid input" from a union.
const createDataPointsBody = z.array(dataPointInput).min(1, 'Provide at least one data point').max(1000);
const wrapSingleDataPoint = (req: Request, res: Response, next: NextFunction): void => {
  res.locals.single = !Array.isArray(req.body);
  if (res.locals.single) req.body = [req.body];
  next();
};

const dataPointsQuery = paginationQuery.extend({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Loads a dashboard the caller may READ (owner or public). Private dashboards
 * of other users return 404 so their existence is not leaked.
 */
async function getReadable(req: Request, id: string) {
  const dashboard = await prisma.dashboard.findUnique({ where: { id } });
  const isOwner = dashboard && req.user?.id === dashboard.userId;
  if (!dashboard || (!isOwner && !dashboard.isPublic)) throw new NotFoundError('Dashboard');
  return dashboard;
}

/** Loads a dashboard the caller may WRITE (owner only; admins may too). */
async function getWritable(req: Request, id: string) {
  const user = currentUser(req);
  const dashboard = await getReadable(req, id);
  if (dashboard.userId !== user.id && user.role !== 'ADMIN') {
    throw new AuthorizationError('Only the owner can modify this dashboard');
  }
  return dashboard;
}

// ---------- Dashboards CRUD ----------

router.get(
  '/',
  authenticate,
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const where: Prisma.DashboardWhereInput =
      q.scope === 'public' ? { isPublic: true } : { userId: currentUser(req).id };

    const [total, dashboards] = await Promise.all([
      prisma.dashboard.count({ where }),
      prisma.dashboard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { dataPoints: true } } },
      }),
    ]);

    res.json({ data: dashboards, meta: paginationMeta(q, total) });
  }),
);

router.post(
  '/',
  authenticate,
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createBody>;
    const dashboard = await prisma.dashboard.create({ data: { ...body, userId: currentUser(req).id } });
    res.status(201).json({ data: dashboard });
  }),
);

router.get(
  '/:id',
  optionalAuthenticate,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const dashboard = await getReadable(req, req.params.id as string);
    const dataPoints = await prisma.dataPoint.count({ where: { dashboardId: dashboard.id } });
    res.json({ data: { ...dashboard, dataPointsCount: dataPoints } });
  }),
);

router.put(
  '/:id',
  authenticate,
  validate({ params: idParam, body: updateBody }),
  asyncHandler(async (req, res) => {
    const dashboard = await getWritable(req, req.params.id as string);
    const updated = await prisma.dashboard.update({
      where: { id: dashboard.id },
      data: req.body as z.infer<typeof updateBody>,
    });
    res.json({ data: updated });
  }),
);

router.delete(
  '/:id',
  authenticate,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const dashboard = await getWritable(req, req.params.id as string);
    await prisma.dashboard.delete({ where: { id: dashboard.id } }); // data points cascade
    res.status(204).send();
  }),
);

// ---------- Data points ----------

router.get(
  '/:id/datapoints',
  optionalAuthenticate,
  validate({ params: idParam, query: dataPointsQuery }),
  asyncHandler(async (req, res) => {
    const dashboard = await getReadable(req, req.params.id as string);
    const q = req.query as unknown as z.infer<typeof dataPointsQuery>;

    const where: Prisma.DataPointWhereInput = {
      dashboardId: dashboard.id,
      ...((q.from || q.to) && { timestamp: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
    };

    const [total, dataPoints] = await Promise.all([
      prisma.dataPoint.count({ where }),
      prisma.dataPoint.findMany({
        where,
        orderBy: { timestamp: q.order },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    res.json({ data: dataPoints, meta: paginationMeta(q, total) });
  }),
);

router.post(
  '/:id/datapoints',
  authenticate,
  wrapSingleDataPoint,
  validate({ params: idParam, body: createDataPointsBody }),
  asyncHandler(async (req, res) => {
    const dashboard = await getWritable(req, req.params.id as string);
    const body = req.body as z.infer<typeof createDataPointsBody>;
    const rows = body.map((d) => ({ ...d, dashboardId: dashboard.id }));

    const created = await prisma.dataPoint.createManyAndReturn({ data: rows });
    res.status(201).json({ data: res.locals.single ? created[0] : created });
  }),
);

export default router;
