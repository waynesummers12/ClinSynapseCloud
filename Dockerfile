# Use official Deno image
FROM denoland/deno:1.46.0

# Set working directory
WORKDIR /app

# Copy everything into /app
COPY . .

# Create reports folder for generated PDFs
RUN mkdir -p /app/reports

# Cache dependencies (helps with faster builds)
RUN deno cache server/http.ts

# Expose port for Render (must match PORT env var)
EXPOSE 8000

# Run the server with required permissions
CMD ["run", "--allow-env", "--allow-net", "--allow-read=/app", "--allow-write=/app", "server/http.ts"]

