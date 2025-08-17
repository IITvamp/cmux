import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  BookListSchema,
  BookParamsSchema,
  BookSchema,
  CreateBookSchema,
  ErrorSchema,
  ValidationErrorSchema,
} from "../schemas/index";

const booksDb = new Map<
  string,
  {
    id: string;
    title: string;
    author: string;
    isbn?: string;
    publishedYear: number;
    genre: "fiction" | "non-fiction" | "science" | "history" | "biography";
    available: boolean;
  }
>();

booksDb.set("book-1", {
  id: "book-1",
  title: "1984",
  author: "George Orwell",
  isbn: "978-0-452-28423-4",
  publishedYear: 1949,
  genre: "fiction",
  available: true,
});

booksDb.set("book-2", {
  id: "book-2",
  title: "To Kill a Mockingbird",
  author: "Harper Lee",
  isbn: "978-0-06-112008-4",
  publishedYear: 1960,
  genre: "fiction",
  available: false,
});

export const booksRouter = new OpenAPIHono();

booksRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/books",
    tags: ["Books"],
    summary: "List all books",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BookListSchema,
          },
        },
        description: "List of books",
      },
    },
  }),
  (c) => {
    const books = Array.from(booksDb.values());

    return c.json(
      {
        books,
        total: books.length,
      },
      200
    );
  }
);

booksRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/books/{id}",
    tags: ["Books"],
    summary: "Get a book by ID",
    request: {
      params: BookParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BookSchema,
          },
        },
        description: "The book",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Book not found",
      },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const book = booksDb.get(id);

    if (!book) {
      return c.json(
        {
          code: 404,
          message: "Book not found",
        },
        404
      );
    }

    return c.json(book, 200);
  }
);

booksRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/books",
    tags: ["Books"],
    summary: "Add a new book",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateBookSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: BookSchema,
          },
        },
        description: "Book created",
      },
      422: {
        content: {
          "application/json": {
            schema: ValidationErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  }),
  (c) => {
    const data = c.req.valid("json");

    const id = `book-${Date.now()}`;
    const newBook = {
      id,
      ...data,
      available: true,
    };

    booksDb.set(id, newBook);

    return c.json(newBook, 201);
  }
);

booksRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/books/{id}/borrow",
    tags: ["Books"],
    summary: "Borrow a book",
    request: {
      params: BookParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BookSchema,
          },
        },
        description: "Book borrowed successfully",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Book not available",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Book not found",
      },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const book = booksDb.get(id);

    if (!book) {
      return c.json(
        {
          code: 404,
          message: "Book not found",
        },
        404
      );
    }

    if (!book.available) {
      return c.json(
        {
          code: 400,
          message: "Book is not available for borrowing",
        },
        400
      );
    }

    book.available = false;
    booksDb.set(id, book);

    return c.json(book, 200);
  }
);

booksRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/books/{id}/return",
    tags: ["Books"],
    summary: "Return a book",
    request: {
      params: BookParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: BookSchema,
          },
        },
        description: "Book returned successfully",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Book already available",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Book not found",
      },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const book = booksDb.get(id);

    if (!book) {
      return c.json(
        {
          code: 404,
          message: "Book not found",
        },
        404
      );
    }

    if (book.available) {
      return c.json(
        {
          code: 400,
          message: "Book is already available",
        },
        400
      );
    }

    book.available = true;
    booksDb.set(id, book);

    return c.json(book, 200);
  }
);
