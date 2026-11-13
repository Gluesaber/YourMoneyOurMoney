import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`YourMoneyOurMoney API listening on http://localhost:${PORT}`);
});
