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

const users = [];
const products = [];
const refreshTokens = new Map();

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  };
}

function generateAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
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
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { email, first_name, last_name, password } = req.body || {};

  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const existing = users.find((u) => u.email === email);
  if (existing) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email,
    first_name,
    last_name,
    password: passwordHash,
  };

  users.push(user);

  return res.status(201).json(toPublicUser(user));
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and password are required" });
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const tokens = issueTokens(user);

  return res.status(200).json(tokens);
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const userId = req.user && req.user.sub;
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(200).json(toPublicUser(user));
});

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

    const stored = refreshTokens.get(refreshToken);
    if (!stored || stored.userId !== payload.sub) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    refreshTokens.delete(refreshToken);

    const user = users.find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const tokens = issueTokens(user);
    return res.status(200).json(tokens);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

app.post("/api/products", (req, res) => {
  const { title, category, description, price } = req.body || {};

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
});

app.get("/api/products", (req, res) => {
  return res.status(200).json(products);
});

app.get("/api/products/:id", authMiddleware, (req, res) => {
  const product = products.find((p) => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.status(200).json(product);
});

app.put("/api/products/:id", authMiddleware, (req, res) => {
  const product = products.find((p) => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const { title, category, description, price } = req.body || {};

  if (price !== undefined && (typeof price !== "number" || Number.isNaN(price))) {
    return res.status(400).json({ error: "Price must be a number" });
  }

  if (title !== undefined) product.title = title;
  if (category !== undefined) product.category = category;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;

  return res.status(200).json(product);
});

app.delete("/api/products/:id", authMiddleware, (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  products.splice(index, 1);
  return res.status(204).send();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}

module.exports = app;
