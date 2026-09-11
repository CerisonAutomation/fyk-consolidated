"use client";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "2rem", textAlign: "center" }}>
        <h2>Something went wrong!</h2>
        <p>{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>Try again</button>
      </body>
    </html>
  );
}
