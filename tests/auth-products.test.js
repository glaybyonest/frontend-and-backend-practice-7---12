const request = require("supertest");
const app = require("../src/app");

function uniqueEmail() {
  return `user_${Date.now()}_${Math.random().toString(16).slice(2)}@example.com`;
}

describe("Auth and products API", () => {
  const user = {
    email: uniqueEmail(),
    first_name: "Ivan",
    last_name: "Ivanov",
    password: "secret123"
  };

  let accessToken;
  let refreshToken;
  let productId;

  test("register creates user and returns public fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(user)
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body.email).toBe(user.email);
    expect(res.body.first_name).toBe(user.first_name);
    expect(res.body.last_name).toBe(user.last_name);
    expect(res.body.password).toBeUndefined();
  });

  test("login returns access and refresh tokens", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  test("/api/auth/me returns current user without password", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.email).toBe(user.email);
    expect(res.body.password).toBeUndefined();
  });

  test("refresh token returns a new token pair and rotates refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("X-Refresh-Token", refreshToken)
      .expect(200);

    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.refreshToken).not.toBe(refreshToken);

    const oldRefresh = refreshToken;
    refreshToken = res.body.refreshToken;
    accessToken = res.body.accessToken;

    await request(app)
      .post("/api/auth/refresh")
      .set("X-Refresh-Token", oldRefresh)
      .expect(401);
  });

  test("product CRUD with protected routes", async () => {
    const createRes = await request(app)
      .post("/api/products")
      .send({
        title: "Test product",
        category: "Test",
        description: "Description",
        price: 19.99
      })
      .expect(201);

    productId = createRes.body.id;

    await request(app)
      .get(`/api/products/${productId}`)
      .expect(401);

    const getRes = await request(app)
      .get(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.body.id).toBe(productId);

    const updateRes = await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Updated" })
      .expect(200);

    expect(updateRes.body.title).toBe("Updated");

    await request(app)
      .delete(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });
});
