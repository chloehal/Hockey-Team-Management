import http from "node:http";
import { demoTeam, demoResponse } from "../tests/fixtures.js";
const data = structuredClone(demoTeam);
http
  .createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const action = new URL(req.url, "http://localhost").searchParams.get(
        "action",
      );
      const result = demoResponse(data, action, body ? JSON.parse(body) : {});
      res.writeHead(result.error ? 400 : 200, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Requête invalide" }));
    }
  })
  .listen(8020, "127.0.0.1", () =>
    console.log(
      "API de démonstration : http://127.0.0.1:8020 · mot de passe coach : demo",
    ),
  );
