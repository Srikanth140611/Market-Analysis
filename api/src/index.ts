import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { router } from "./routes.js";
import { startNewsToSlackNotifier } from "./services/newsNotifierService.js";

const app = express();

app.use(
  cors({
    origin: config.ALLOWED_ORIGIN === "*" ? true : config.ALLOWED_ORIGIN
  })
);
app.use(express.json());
app.use(router);

app.listen(config.PORT, () => {
  console.log(`Market Analysis API running at http://localhost:${config.PORT}`);
  startNewsToSlackNotifier();
});
