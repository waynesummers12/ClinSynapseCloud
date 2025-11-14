FROM denoland/deno:1.45.5

WORKDIR /app
COPY . .

RUN deno cache server/http.ts

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "server/http.ts"]
