FROM denoland/deno:1.46.0

WORKDIR /app

# Copy all files
COPY . .

# Cache dependencies
RUN deno cache server/http.ts

# Start the server
CMD ["run", "--allow-env", "--allow-net", "--allow-read", "--allow-write", "server/http.ts"]
