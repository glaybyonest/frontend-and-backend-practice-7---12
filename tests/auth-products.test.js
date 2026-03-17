const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");

function uniqueEmail(prefix = "user") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}@example.com`;
}

async function registerUser(overrides = {}) {
  const payload = {
    email: uniqueEmail(overrides.role || "user"),
    first_name: "Ivan",
    last_name: "Ivanov",
    password: "secret123",
    ...overrides,
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send(payload)
    .expect(201);

  return { payload, user: response.body };
}

async function loginUser(credentials, expectedStatus = 200) {
  return request(app)
    .post("/api/auth/login")
    .send(credentials)
    .expect(expectedStatus);
}

async function loginAdmin() {
  const admin = app.locals.bootstrapAdminCredentials;
  const response = await loginUser({
    email: admin.email,
    password: admin.password,
  });

  return response.body;
}

function bearer(token) {
  return `Bearer ${token}`;
}

describe("Auth, RBAC and products API", () => {
  beforeEach(() => {
    app.locals.resetState();
  });

  test("register, login, me and refresh expose role and rotate refresh token", async () => {
    const { payload, user } = await registerUser();

    expect(user).toHaveProperty("id");
    expect(user.email).toBe(payload.email);
    expect(user.role).toBe("user");
    expect(user.isBlocked).toBe(false);
    expect(user.password).toBeUndefined();

    const loginResponse = await loginUser({
      email: payload.email,
      password: payload.password,
    });

    expect(loginResponse.body).toHaveProperty("accessToken");
    expect(loginResponse.body).toHaveProperty("refreshToken");

    const accessPayload = jwt.decode(loginResponse.body.accessToken);
    const refreshPayload = jwt.decode(loginResponse.body.refreshToken);

    expect(accessPayload.role).toBe("user");
    expect(refreshPayload.role).toBe("user");
    expect(refreshPayload.type).toBe("refresh");

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", bearer(loginResponse.body.accessToken))
      .expect(200);

    expect(meResponse.body.email).toBe(payload.email);
    expect(meResponse.body.role).toBe("user");
    expect(meResponse.body.password).toBeUndefined();

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: loginResponse.body.refreshToken })
      .expect(200);

    expect(refreshResponse.body).toHaveProperty("accessToken");
    expect(refreshResponse.body).toHaveProperty("refreshToken");
    expect(refreshResponse.body.refreshToken).not.toBe(loginResponse.body.refreshToken);

    await request(app)
      .post("/api/auth/refresh")
      .set("Authorization", bearer(loginResponse.body.refreshToken))
      .expect(401);
  });

  test("product routes follow role permissions", async () => {
    const adminTokens = await loginAdmin();

    const { payload: userCredentials, user: plainUser } = await registerUser({
      email: uniqueEmail("viewer"),
    });
    const userTokens = (
      await loginUser({
        email: userCredentials.email,
        password: userCredentials.password,
      })
    ).body;

    await request(app).get("/api/products").expect(401);

    const listResponse = await request(app)
      .get("/api/products")
      .set("Authorization", bearer(userTokens.accessToken))
      .expect(200);

    expect(listResponse.body).toEqual([]);

    await request(app)
      .post("/api/products")
      .set("Authorization", bearer(userTokens.accessToken))
      .send({
        title: "Viewer product",
        category: "Test",
        description: "Should fail",
        price: 19.99,
      })
      .expect(403);

    const { payload: sellerCredentials, user: sellerUser } = await registerUser({
      email: uniqueEmail("seller"),
    });

    await request(app)
      .put(`/api/users/${sellerUser.id}`)
      .set("Authorization", bearer(adminTokens.accessToken))
      .send({ role: "seller" })
      .expect(200);

    const sellerTokens = (
      await loginUser({
        email: sellerCredentials.email,
        password: sellerCredentials.password,
      })
    ).body;

    const createResponse = await request(app)
      .post("/api/products")
      .set("Authorization", bearer(sellerTokens.accessToken))
      .send({
        title: "Seller product",
        category: "Tools",
        description: "Created by seller",
        price: 29.99,
      })
      .expect(201);

    const productId = createResponse.body.id;

    await request(app)
      .get(`/api/products/${productId}`)
      .set("Authorization", bearer(userTokens.accessToken))
      .expect(200);

    await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", bearer(userTokens.accessToken))
      .send({ title: "User cannot edit" })
      .expect(403);

    const sellerUpdateResponse = await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", bearer(sellerTokens.accessToken))
      .send({ title: "Updated by seller" })
      .expect(200);

    expect(sellerUpdateResponse.body.title).toBe("Updated by seller");

    await request(app)
      .delete(`/api/products/${productId}`)
      .set("Authorization", bearer(sellerTokens.accessToken))
      .expect(403);

    await request(app)
      .delete(`/api/products/${productId}`)
      .set("Authorization", bearer(adminTokens.accessToken))
      .expect(204);

    expect(plainUser.role).toBe("user");
  });

  test("admin-only user management routes work and reject non-admins", async () => {
    const adminTokens = await loginAdmin();
    const { payload, user } = await registerUser({
      email: uniqueEmail("managed"),
    });
    const userTokens = (
      await loginUser({
        email: payload.email,
        password: payload.password,
      })
    ).body;

    await request(app)
      .get("/api/users")
      .set("Authorization", bearer(userTokens.accessToken))
      .expect(403);

    const usersResponse = await request(app)
      .get("/api/users")
      .set("Authorization", bearer(adminTokens.accessToken))
      .expect(200);

    expect(usersResponse.body.length).toBeGreaterThanOrEqual(2);
    expect(usersResponse.body.some((item) => item.id === user.id)).toBe(true);

    const currentUserResponse = await request(app)
      .get(`/api/users/${user.id}`)
      .set("Authorization", bearer(adminTokens.accessToken))
      .expect(200);

    expect(currentUserResponse.body.email).toBe(payload.email);

    const updateResponse = await request(app)
      .put(`/api/users/${user.id}`)
      .set("Authorization", bearer(adminTokens.accessToken))
      .send({
        first_name: "Petr",
        last_name: "Petrov",
        role: "seller",
        isBlocked: false,
      })
      .expect(200);

    expect(updateResponse.body.first_name).toBe("Petr");
    expect(updateResponse.body.last_name).toBe("Petrov");
    expect(updateResponse.body.role).toBe("seller");
    expect(updateResponse.body.isBlocked).toBe(false);
  });

  test("blocked user cannot login, refresh or use protected routes", async () => {
    const adminTokens = await loginAdmin();
    const { payload, user } = await registerUser({
      email: uniqueEmail("blocked"),
    });
    const loginResponse = await loginUser({
      email: payload.email,
      password: payload.password,
    });

    await request(app)
      .delete(`/api/users/${user.id}`)
      .set("Authorization", bearer(adminTokens.accessToken))
      .expect(200);

    await loginUser(
      {
        email: payload.email,
        password: payload.password,
      },
      403
    );

    await request(app)
      .post("/api/auth/refresh")
      .set("X-Refresh-Token", loginResponse.body.refreshToken)
      .expect(403);

    await request(app)
      .get("/api/products")
      .set("Authorization", bearer(loginResponse.body.accessToken))
      .expect(403);
  });
});
