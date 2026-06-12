# Use official Playwright image which includes all browser deps
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers (Chromium only to keep image size down)
RUN npx playwright install chromium

# Copy source
COPY . .

# Create data directory for LowDB
RUN mkdir -p data

# Expose port
EXPOSE 3001

CMD ["node", "src/index.js"]
