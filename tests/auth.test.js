import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
const dir = mkdtempSync(tmpdir() + "/nexora-test-");
process.env.DATA_DIR = dir;
delete process.env.DATABASE_URL;
let server, base;
before(async () => {
  const { createApp } = await import("../server/app.js");
  server = (await createApp()).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  const { close } = await import("../server/db.js");
  await close();
  rmSync(dir, { recursive: true, force: true });
});
async function call(path, method = "GET", body, token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json(), headers: r.headers };
}
test("authentication lifecycle, ownership isolation, and revocation", async () => {
  assert.equal((await call("/dashboard")).status, 401);
  assert.equal(
    (
      await call("/auth/register", "POST", {
        name: "A",
        email: "invalid",
        password: "123",
      })
    ).status,
    400,
  );
  const a = await call("/auth/register", "POST", {
    name: "Test Operator",
    email: "operator@example.com",
    password: "Strong123!",
  });
  assert.equal(a.status, 201);
  assert.ok(a.headers.get("set-cookie").includes("HttpOnly"));
  assert.ok(a.headers.get("set-cookie").includes("SameSite=Strict"));
  const token = a.data.token;
  assert.ok(!a.data.user.password);
  assert.equal(
    (
      await call("/auth/register", "POST", {
        name: "Test Operator",
        email: "operator@example.com",
        password: "Strong123!",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/auth/login", "POST", {
        email: "operator@example.com",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (await call("/auth/session", "GET", undefined, token)).data.user.email,
    "operator@example.com",
  );
  const m = await call(
    "/missions",
    "POST",
    { title: "Launch reactor", priority: "high" },
    token,
  );
  assert.equal(m.status, 201);
  const b = await call("/auth/register", "POST", {
    name: "Other Operator",
    email: "other@example.com",
    password: "Strong123!",
  });
  const other = b.data.token;
  assert.equal(
    (await call("/dashboard", "GET", undefined, other)).data.missions.length,
    0,
  );
  assert.equal(
    (
      await call(
        "/missions/" + m.data.id,
        "PATCH",
        { status: "complete" },
        other,
      )
    ).status,
    404,
  );
  assert.equal(
    (await call("/missions/" + m.data.id, "DELETE", undefined, other)).status,
    404,
  );
  assert.equal(
    (
      await call(
        "/missions/" + m.data.id,
        "PATCH",
        { status: "invalid" },
        token,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/missions/" + m.data.id,
        "PATCH",
        { status: "complete" },
        token,
      )
    ).data.status,
    "complete",
  );
  assert.equal(
    (await call("/account", "PATCH", { name: "Updated Operator" }, token)).data
      .user.name,
    "Updated Operator",
  );
  const login = await call("/auth/login", "POST", {
    email: "operator@example.com",
    password: "Strong123!",
  });
  assert.equal(login.status, 200);
  await call("/account/revoke", "POST", {}, token);
  assert.equal(
    (await call("/dashboard", "GET", undefined, login.data.token)).status,
    401,
  );
  const pw = await call(
    "/account/password",
    "PATCH",
    { currentPassword: "Strong123!", password: "Updated456!" },
    token,
  );
  assert.equal(pw.status, 200);
  assert.equal((await call("/dashboard", "GET", undefined, token)).status, 401);
  assert.equal(
    (
      await call("/auth/login", "POST", {
        email: "operator@example.com",
        password: "Strong123!",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/auth/login", "POST", {
        email: "operator@example.com",
        password: "Updated456!",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/missions/" + m.data.id, "DELETE", undefined, pw.data.token))
      .status,
    200,
  );
  await call("/auth/logout", "POST", {}, pw.data.token);
  assert.equal(
    (await call("/dashboard", "GET", undefined, pw.data.token)).status,
    401,
  );
});
test("rejects cross-origin writes and forged tokens", async () => {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
  assert.equal(
    (await call("/dashboard", "GET", undefined, "fake.jwt.token")).status,
    401,
  );
});
