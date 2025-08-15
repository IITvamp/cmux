import { z } from "@hono/zod-openapi";

export const UserSchema = z
  .object({
    id: z.string().openapi({
      example: "user-123",
    }),
    name: z.string().openapi({
      example: "John Doe",
    }),
    email: z.string().email().openapi({
      example: "john@example.com",
    }),
    age: z.number().min(0).max(150).optional().openapi({
      example: 30,
    }),
    createdAt: z.string().datetime().openapi({
      example: "2024-01-01T00:00:00Z",
    }),
  })
  .openapi("User");

export const CreateUserSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    age: z.number().min(0).max(150).optional(),
  })
  .openapi("CreateUser");

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    age: z.number().min(0).max(150).optional(),
  })
  .openapi("UpdateUser");

export const UserParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      example: "user-123",
    }),
});

export const UserListSchema = z
  .object({
    users: z.array(UserSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  })
  .openapi("UserList");

export const UserQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default(1)
    .openapi({
      param: {
        name: "page",
        in: "query",
      },
      example: "1",
    }),
  pageSize: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default(10)
    .openapi({
      param: {
        name: "pageSize",
        in: "query",
      },
      example: "10",
    }),
  search: z
    .string()
    .optional()
    .openapi({
      param: {
        name: "search",
        in: "query",
      },
      example: "john",
    }),
});
