FROM denoland/deno:1.48.0

WORKDIR /app
COPY . .

# Pre-cache dependencies to speed startup
RUN deno cache server/http.ts

# Start the server
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "server/http.ts"]
