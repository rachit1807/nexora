import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { db, init } from "./db.js";
export async function createApp() {
  await init();
  const app = express();
  const production = process.env.NODE_ENV === "production";
  if (production && !process.env.JWT_SECRET)
    throw Error("JWT_SECRET is required in production");
  const secret = process.env.JWT_SECRET || randomBytes(48).toString("hex");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 150,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== `${req.protocol}://${req.get("host")}`
    )
      return res
        .status(403)
        .json({ message: "Request origin is not allowed." });
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 25,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
  });
  const safe = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.created_at,
  });
  const activity = async (id, event) =>
    db("INSERT INTO activity VALUES (?,?,?,?)", [
      randomUUID(),
      id,
      event,
      new Date().toISOString(),
    ]);
  const issue = async (res, u) => {
    const sid = randomUUID(),
      expires = new Date(Date.now() + 7 * 86400000).toISOString();
    await db("INSERT INTO sessions VALUES (?,?,?)", [sid, u.id, expires]);
    const token = jwt.sign({ sid }, secret, {
      subject: u.id,
      expiresIn: "7d",
      issuer: "nexora",
      audience: "nexora-web",
    });
    res.cookie("nexora_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 7 * 86400000,
      path: "/",
    });
    return token;
  };
  const auth = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : req.cookies.nexora_session;
      if (!token) throw Error();
      const claims = jwt.verify(token, secret, {
        issuer: "nexora",
        audience: "nexora-web",
      });
      const sessions = await db(
        "SELECT * FROM sessions WHERE id=? AND user_id=? AND expires_at>?",
        [claims.sid, claims.sub, new Date().toISOString()],
      );
      const [user] = await db("SELECT * FROM users WHERE id=?", [claims.sub]);
      if (!sessions.length || !user) throw Error();
      req.user = user;
      req.sid = claims.sid;
      req.token = token;
      next();
    } catch {
      res
        .status(401)
        .json({ message: "Your session has ended. Please sign in again." });
    }
  };
  const emailValue = (v) =>
    typeof v === "string" ? v.trim().toLowerCase() : "";
  const validPassword = (p) =>
    typeof p === "string" &&
    p.length >= 8 &&
    p.length <= 128 &&
    /[a-zA-Z]/.test(p) &&
    /\d/.test(p);
  app.get("/api/health", async (req, res) => {
    await db("SELECT 1");
    res.json({ status: "online", service: "nexora" });
  });
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const { name, password } = req.body,
      email = emailValue(req.body.email);
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 50 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      !validPassword(password)
    )
      return res
        .status(400)
        .json({
          message:
            "Enter a name (2–50 characters), valid email, and an 8–128 character password with letters and numbers.",
        });
    if ((await db("SELECT id FROM users WHERE email=?", [email])).length)
      return res
        .status(409)
        .json({
          message: "This email is already registered. Sign in instead.",
        });
    const u = {
      id: randomUUID(),
      name: name.trim(),
      email,
      password: await bcrypt.hash(password, 12),
      created_at: new Date().toISOString(),
    };
    try {
      await db("INSERT INTO users VALUES (?,?,?,?,?)", [
        u.id,
        u.name,
        u.email,
        u.password,
        u.created_at,
      ]);
    } catch (e) {
      if (String(e).includes("UNIQUE") || e.code === "23505")
        return res
          .status(409)
          .json({
            message: "This email is already registered. Sign in instead.",
          });
      throw e;
    }
    await activity(u.id, "Account created");
    res.status(201).json({ user: safe(u), token: await issue(res, u) });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const email = emailValue(req.body.email),
      password = req.body.password;
    if (typeof password !== "string" || password.length > 128)
      return res
        .status(400)
        .json({ message: "Enter your email and password." });
    const [u] = await db("SELECT * FROM users WHERE email=?", [email]);
    const fallback =
      "$2b$12$KIXxNiJbZdqGGXVwMAsGhu4E5PjQW3CG31XKqWX15cGjZ7rGFawYa";
    const match = await bcrypt.compare(password, u?.password || fallback);
    if (!u || !match)
      return res
        .status(401)
        .json({ message: "Email or password is incorrect." });
    await activity(u.id, "Signed in to command center");
    res.json({ user: safe(u), token: await issue(res, u) });
  });
  app.get("/api/auth/session", auth, (req, res) =>
    res.json({ user: safe(req.user), token: req.token }),
  );
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db("DELETE FROM sessions WHERE id=?", [req.sid]);
    await activity(req.user.id, "Signed out");
    res.clearCookie("nexora_session", {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
    });
    res.json({ message: "Signed out securely." });
  });
  app.get("/api/dashboard", auth, async (req, res) =>
    res.json({
      missions: await db(
        "SELECT * FROM missions WHERE user_id=? ORDER BY created_at DESC",
        [req.user.id],
      ),
      activity: await db(
        "SELECT event,created_at FROM activity WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
        [req.user.id],
      ),
      sessions: (
        await db("SELECT id FROM sessions WHERE user_id=? AND expires_at>?", [
          req.user.id,
          new Date().toISOString(),
        ])
      ).length,
    }),
  );
  app.post("/api/missions", auth, async (req, res) => {
    const { title, priority = "normal" } = req.body;
    if (
      typeof title !== "string" ||
      title.trim().length < 3 ||
      title.trim().length > 120 ||
      !["normal", "high", "critical"].includes(priority)
    )
      return res
        .status(400)
        .json({
          message:
            "Mission title must be 3–120 characters and priority must be valid.",
        });
    const m = {
      id: randomUUID(),
      user_id: req.user.id,
      title: title.trim(),
      priority,
      status: "queued",
      created_at: new Date().toISOString(),
    };
    await db("INSERT INTO missions VALUES (?,?,?,?,?,?)", Object.values(m));
    await activity(req.user.id, "Mission created");
    res.status(201).json(m);
  });
  app.patch("/api/missions/:id", auth, async (req, res) => {
    if (!["queued", "active", "complete"].includes(req.body.status))
      return res
        .status(400)
        .json({ message: "Choose a valid mission status." });
    const rows = await db(
      "UPDATE missions SET status=? WHERE id=? AND user_id=? RETURNING *",
      [req.body.status, req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Mission not found." });
    await activity(req.user.id, `Mission marked ${req.body.status}`);
    res.json(rows[0]);
  });
  app.delete("/api/missions/:id", auth, async (req, res) => {
    const rows = await db(
      "DELETE FROM missions WHERE id=? AND user_id=? RETURNING id",
      [req.params.id, req.user.id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "Mission not found." });
    await activity(req.user.id, "Mission deleted");
    res.json({ message: "Mission deleted." });
  });
  app.patch("/api/account", auth, async (req, res) => {
    const name = req.body.name;
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 50
    )
      return res
        .status(400)
        .json({ message: "Name must contain 2–50 characters." });
    await db("UPDATE users SET name=? WHERE id=?", [name.trim(), req.user.id]);
    await activity(req.user.id, "Profile updated");
    res.json({ user: safe({ ...req.user, name: name.trim() }) });
  });
  app.patch("/api/account/password", auth, async (req, res) => {
    const { currentPassword, password } = req.body;
    if (
      typeof currentPassword !== "string" ||
      currentPassword.length > 128 ||
      !validPassword(password)
    )
      return res
        .status(400)
        .json({
          message:
            "Use an 8–128 character new password with letters and numbers.",
        });
    if (!(await bcrypt.compare(currentPassword, req.user.password)))
      return res
        .status(400)
        .json({ message: "Current password is incorrect." });
    await db("UPDATE users SET password=? WHERE id=?", [
      await bcrypt.hash(password, 12),
      req.user.id,
    ]);
    await db("DELETE FROM sessions WHERE user_id=?", [req.user.id]);
    await activity(req.user.id, "Password changed; all sessions revoked");
    res.json({ user: safe(req.user), token: await issue(res, req.user) });
  });
  app.post("/api/account/revoke", auth, async (req, res) => {
    await db("DELETE FROM sessions WHERE user_id=? AND id<>?", [
      req.user.id,
      req.sid,
    ]);
    await activity(req.user.id, "Other sessions revoked");
    res.json({ message: "Other sessions have been signed out." });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((err, req, res, next) => {
    console.error(err.message);
    res
      .status(err.status === 400 ? 400 : 500)
      .json({
        message:
          err.status === 400
            ? "Invalid request."
            : "Something went wrong. Please try again.",
      });
  });
  return app;
}
