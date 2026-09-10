import { copyFile, access } from "node:fs/promises";
// Keep the existing PHP API alongside the frontend. Never bundle DB credentials.
await copyFile("api.php", "dist/api.php");
await copyFile("player-evaluations.php", "dist/player-evaluations.php");
await copyFile(".htaccess", "dist/.htaccess");
await access("dist/index.html");
await access("dist/coach.html");
