import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;

export const paginationMeta = (p: Pagination, total: number) => ({
  page: p.page,
  limit: p.limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / p.limit)),
});

export const idParam = z.object({ id: z.uuid('id must be a valid UUID') });
