import { createApp } from "./app.js";
const app = await createApp();
const server = app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
  console.log(`Nexora ready on port ${process.env.PORT || 3001}`),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
