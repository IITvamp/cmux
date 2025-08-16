import { z } from "@hono/zod-openapi";

export const BookSchema = z
  .object({
    id: z.string().openapi({
      example: "book-456",
    }),
    title: z.string().openapi({
      example: "The Great Gatsby",
    }),
    author: z.string().openapi({
      example: "F. Scott Fitzgerald",
    }),
    isbn: z.string().optional().openapi({
      example: "978-0-7432-7356-5",
    }),
    publishedYear: z.number().openapi({
      example: 1925,
    }),
    genre: z.enum(["fiction", "non-fiction", "science", "history", "biography"]).openapi({
      example: "fiction",
    }),
    available: z.boolean().openapi({
      example: true,
    }),
  })
  .openapi("Book");

export const CreateBookSchema = z
  .object({
    title: z.string().min(1).max(200),
    author: z.string().min(1).max(100),
    isbn: z.string().optional(),
    publishedYear: z.number().min(1000).max(new Date().getFullYear()),
    genre: z.enum(["fiction", "non-fiction", "science", "history", "biography"]),
  })
  .openapi("CreateBook");

export const BookParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: {
      name: "id",
      in: "path",
    },
    example: "book-456",
  }),
});

export const BookListSchema = z
  .object({
    books: z.array(BookSchema),
    total: z.number(),
  })
  .openapi("BookList");