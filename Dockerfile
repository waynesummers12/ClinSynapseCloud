# Use official Deno image
FROM denoland/deno:1.46.0

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Create output folder for generated PDFs
RUN mkdir -p /app/reports

# Cache dependencies (point to your real entry file)
RUN deno cache main.ts

# Expose port 8000 (Render will map automatically)
EXPOSE 8000

# Start your API server
CMD ["run", "--allow-env", "--allow-net", "--allow-read", "--allow-write=/app/reports,/tmp", "main.ts"]





