FROM node:20-alpine

# Install build dependencies for native modules and basic shell tools
RUN apk add --no-cache libc6-compat python3 make g++ git bash coreutils

WORKDIR /app

# Copy package configuration
COPY package*.json ./
RUN npm install

# Copy codebase
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Set production environment configurations
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Start Next.js server on Hugging Face's expected port
CMD ["npm", "run", "start", "--", "-p", "7860"]
