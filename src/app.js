const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    process.env.CORS_ORIGIN || "*"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Refresh-Token"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "access_secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret";
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

const ROLES = {
  USER: "user",
  SELLER: "seller",
  ADMIN: "admin",
};

const ALL_AUTH_ROLES = [ROLES.USER, ROLES.SELLER, ROLES.ADMIN];

const DEFAULT_ADMIN = {
  email: "admin@example.com",
  password: "admin12345",
  first_name: "Local",
  last_name: "Admin",
};

const users = [];
const products = [];
const refreshTokens = new Map();

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    isBlocked: Boolean(user.isBlocked),
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
    }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "refresh",
      jti: randomUUID(),
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

function issueTokens(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.set(refreshToken, { userId: user.id });
  return { accessToken, refreshToken };
}

function getRefreshToken(req) {
  const headerToken = req.get("x-refresh-token");
  if (headerToken) return headerToken;

  const authHeader = req.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  if (req.body && typeof req.body.refreshToken === "string") {
    return req.body.refreshToken;
  }

  return null;
}

function findUserById(id) {
  return users.find((user) => user.id === id);
}

function revokeRefreshTokensForUser(userId) {
  for (const [token, session] of refreshTokens.entries()) {
    if (session.userId === userId) {
      refreshTokens.delete(token);
    }
  }
}

function getBootstrapAdminConfig() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL) || DEFAULT_ADMIN.email,
    password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password,
    first_name:
      normalizeText(process.env.ADMIN_FIRST_NAME) || DEFAULT_ADMIN.first_name,
    last_name:
      normalizeText(process.env.ADMIN_LAST_NAME) || DEFAULT_ADMIN.last_name,
  };
}

function bootstrapAdmin() {
  const existingAdmin = users.find((user) => user.role === ROLES.ADMIN);
  if (existingAdmin) {
    return existingAdmin;
  }

  const adminConfig = getBootstrapAdminConfig();
  const adminUser = {
    id: randomUUID(),
    email: adminConfig.email,
    first_name: adminConfig.first_name,
    last_name: adminConfig.last_name,
    password: bcrypt.hashSync(adminConfig.password, 10),
    role: ROLES.ADMIN,
    isBlocked: false,
  };

  users.push(adminUser);
  return adminUser;
}

function resetState() {
  users.length = 0;
  products.length = 0;
  refreshTokens.clear();
  bootstrapAdmin();
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      revokeRefreshTokensForUser(user.id);
      return res.status(403).json({ error: "User is blocked" });
    }

    req.auth = payload;
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return next();
  };
}

function parseBlockedValue(body) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(body, "isBlocked")) {
    return body.isBlocked;
  }

  if (Object.prototype.hasOwnProperty.call(body, "blocked")) {
    return body.blocked;
  }

  return undefined;
}

bootstrapAdmin();

app.locals.resetState = resetState;
app.locals.state = { users, products, refreshTokens };
app.locals.bootstrapAdminCredentials = getBootstrapAdminConfig();

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const firstName = normalizeText(req.body && req.body.first_name);
  const lastName = normalizeText(req.body && req.body.last_name);
  const password = req.body && req.body.password;

  if (!email || !firstName || !lastName || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const existing = users.find((user) => user.email === email);
  if (existing) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email,
    first_name: firstName,
    last_name: lastName,
    password: passwordHash,
    role: ROLES.USER,
    isBlocked: false,
  };

  users.push(user);

  return res.status(201).json(toPublicUser(user));
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const { password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and password are required" });
  }

  const user = users.find((item) => item.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.isBlocked) {
    revokeRefreshTokensForUser(user.id);
    return res.status(403).json({ error: "User is blocked" });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const tokens = issueTokens(user);

  return res.status(200).json(tokens);
});

app.get(
  "/api/auth/me",
  authMiddleware,
  roleMiddleware(ALL_AUTH_ROLES),
  (req, res) => {
    return res.status(200).json(toPublicUser(req.user));
  }
);

app.post("/api/auth/refresh", (req, res) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ error: "Missing refresh token" });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (!payload || payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      refreshTokens.delete(refreshToken);
      revokeRefreshTokensForUser(user.id);
      return res.status(403).json({ error: "User is blocked" });
    }

    const stored = refreshTokens.get(refreshToken);
    if (!stored || stored.userId !== payload.sub) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    refreshTokens.delete(refreshToken);

    const tokens = issueTokens(user);
    return res.status(200).json(tokens);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

app.get(
  "/api/users",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    return res.status(200).json(users.map(toPublicUser));
  }
);

app.get(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(toPublicUser(user));
  }
);

app.put(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const email = req.body && Object.prototype.hasOwnProperty.call(req.body, "email")
      ? normalizeEmail(req.body.email)
      : undefined;
    const firstName =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "first_name")
        ? normalizeText(req.body.first_name)
        : undefined;
    const lastName =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "last_name")
        ? normalizeText(req.body.last_name)
        : undefined;
    const role =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "role")
        ? req.body.role
        : undefined;
    const blockedValue = parseBlockedValue(req.body);

    if (
      email === undefined &&
      firstName === undefined &&
      lastName === undefined &&
      role === undefined &&
      blockedValue === undefined
    ) {
      return res.status(400).json({ error: "No fields to update" });
    }

    if (email !== undefined) {
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const duplicate = users.find(
        (item) => item.email === email && item.id !== user.id
      );
      if (duplicate) {
        return res.status(409).json({ error: "Email already exists" });
      }

      user.email = email;
    }

    if (firstName !== undefined) {
      if (!firstName) {
        return res.status(400).json({ error: "First name is required" });
      }
      user.first_name = firstName;
    }

    if (lastName !== undefined) {
      if (!lastName) {
        return res.status(400).json({ error: "Last name is required" });
      }
      user.last_name = lastName;
    }

    if (role !== undefined) {
      if (!ALL_AUTH_ROLES.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      user.role = role;
    }

    if (blockedValue !== undefined) {
      if (typeof blockedValue !== "boolean") {
        return res.status(400).json({ error: "isBlocked must be a boolean" });
      }

      if (user.id === req.user.id && blockedValue) {
        return res.status(400).json({ error: "Admin cannot block themselves" });
      }

      user.isBlocked = blockedValue;
      if (blockedValue) {
        revokeRefreshTokensForUser(user.id);
      }
    }

    return res.status(200).json(toPublicUser(user));
  }
);

app.delete(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const user = findUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: "Admin cannot block themselves" });
    }

    user.isBlocked = true;
    revokeRefreshTokensForUser(user.id);

    return res.status(200).json(toPublicUser(user));
  }
);

app.post(
  "/api/products",
  authMiddleware,
  roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    const title = normalizeText(req.body && req.body.title);
    const category = normalizeText(req.body && req.body.category);
    const description = normalizeText(req.body && req.body.description);
    const { price } = req.body || {};

    if (!title || !category || !description || price === undefined) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (typeof price !== "number" || Number.isNaN(price)) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    const product = {
      id: randomUUID(),
      title,
      category,
      description,
      price,
    };

    products.push(product);

    return res.status(201).json(product);
  }
);

app.get(
  "/api/products",
  authMiddleware,
  roleMiddleware(ALL_AUTH_ROLES),
  (req, res) => {
    return res.status(200).json(products);
  }
);

app.get(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware(ALL_AUTH_ROLES),
  (req, res) => {
    const product = products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.status(200).json(product);
  }
);

app.put(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    const product = products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const title =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "title")
        ? normalizeText(req.body.title)
        : undefined;
    const category =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "category")
        ? normalizeText(req.body.category)
        : undefined;
    const description =
      req.body && Object.prototype.hasOwnProperty.call(req.body, "description")
        ? normalizeText(req.body.description)
        : undefined;
    const { price } = req.body || {};

    if (title !== undefined && !title) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    if (category !== undefined && !category) {
      return res.status(400).json({ error: "Category cannot be empty" });
    }

    if (description !== undefined && !description) {
      return res.status(400).json({ error: "Description cannot be empty" });
    }

    if (price !== undefined && (typeof price !== "number" || Number.isNaN(price))) {
      return res.status(400).json({ error: "Price must be a number" });
    }

    if (title !== undefined) product.title = title;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;

    return res.status(200).json(product);
  }
);

app.delete(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    const index = products.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Product not found" });
    }

    products.splice(index, 1);
    return res.status(204).send();
  }
);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}

module.exports = app;
