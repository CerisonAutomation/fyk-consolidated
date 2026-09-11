import { createServer } from "vite";

const server = await createServer({
  server: { port: 3000 },
  appType: "custom",
});

server.middlewares.use((req, res, next) => {
  try {
    next();
  } catch (err) {
    console.error("SSR Error:", err);
    res.setHeader("Content-Type", "text/html");
    res.end(`
      <!DOCTYPE html>
      <html><head><title>FYK</title></head>
      <body>
        <div id="root"></div>
        <script type="module" src="/@id/virtual:tanstack-start-dev-client-entry"></script>
      </body>
    </html>
    `);
  }
});

await server.listen();
console.log("Server running at http://localhost:3000");
