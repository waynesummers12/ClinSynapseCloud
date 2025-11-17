# Use official Deno image
FROM denoland/deno:1.46.0

# Set working directory
WORKDIR /app

# Copy everything into /app
COPY . .

# Create reports folder for generated PDFs
RUN mkdir -p /app/reports

# Cache dependencies
RUN deno cache server/http.ts

# Expose port (informational)
EXPOSE 8000

# Run server with correct permissions
CMD ["run", "--allow-env", "--allow-net", "--allow-read", "--allow-write=/tmp,/app/reports", "server/http.ts"]




