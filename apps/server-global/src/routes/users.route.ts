import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  CreateUserSchema,
  ErrorSchema,
  UpdateUserSchema,
  UserListSchema,
  UserParamsSchema,
  UserQuerySchema,
  UserSchema,
  ValidationErrorSchema,
} from "../schemas/index.js";

const usersDb = new Map<
  string,
  {
    id: string;
    name: string;
    email: string;
    age?: number;
    createdAt: string;
  }
>();

usersDb.set("user-1", {
  id: "user-1",
  name: "Alice Johnson",
  email: "alice@example.com",
  age: 28,
  createdAt: new Date().toISOString(),
});

usersDb.set("user-2", {
  id: "user-2",
  name: "Bob Smith",
  email: "bob@example.com",
  age: 35,
  createdAt: new Date().toISOString(),
});

export const usersRouter = new OpenAPIHono();

usersRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/users",
    tags: ["Users"],
    summary: "List all users",
    request: {
      query: UserQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UserListSchema,
          },
        },
        description: "List of users",
      },
    },
  }),
  (c) => {
    const { page, pageSize, search } = c.req.valid("query");

    let users = Array.from(usersDb.values());

    if (search) {
      users = users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedUsers = users.slice(start, end);

    return c.json(
      {
        users: paginatedUsers,
        total: users.length,
        page,
        pageSize,
      },
      200
    );
  }
);

usersRouter.openapi(
  createRoute({
    method: "get" as const,
    path: "/users/{id}",
    tags: ["Users"],
    summary: "Get a user by ID",
    request: {
      params: UserParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UserSchema,
          },
        },
        description: "The user",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");
    const user = usersDb.get(id);

    if (!user) {
      return c.json(
        {
          code: 404,
          message: "User not found",
        },
        404
      );
    }

    return c.json(user, 200);
  }
);

usersRouter.openapi(
  createRoute({
    method: "post" as const,
    path: "/users",
    tags: ["Users"],
    summary: "Create a new user",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateUserSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: UserSchema,
          },
        },
        description: "User created",
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

    const id = `user-${Date.now()}`;
    const newUser = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    };

    usersDb.set(id, newUser);

    return c.json(newUser, 201);
  }
);

usersRouter.openapi(
  createRoute({
    method: "patch" as const,
    path: "/users/{id}",
    tags: ["Users"],
    summary: "Update a user",
    request: {
      params: UserParamsSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateUserSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UserSchema,
          },
        },
        description: "User updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
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
    const { id } = c.req.valid("param");
    const updates = c.req.valid("json");

    const user = usersDb.get(id);
    if (!user) {
      return c.json(
        {
          code: 404,
          message: "User not found",
        },
        404
      );
    }

    const updatedUser = {
      ...user,
      ...updates,
    };

    usersDb.set(id, updatedUser);

    return c.json(updatedUser, 200);
  }
);

usersRouter.openapi(
  createRoute({
    method: "delete" as const,
    path: "/users/{id}",
    tags: ["Users"],
    summary: "Delete a user",
    request: {
      params: UserParamsSchema,
    },
    responses: {
      204: {
        description: "User deleted",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "User not found",
      },
    },
  }),
  (c) => {
    const { id } = c.req.valid("param");

    if (!usersDb.has(id)) {
      return c.json(
        {
          code: 404,
          message: "User not found",
        },
        404
      );
    }

    usersDb.delete(id);

    return c.body(null, 204);
  }
);
