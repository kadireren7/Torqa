# Torqa dashboard — production image (Next.js `next start`).
FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
