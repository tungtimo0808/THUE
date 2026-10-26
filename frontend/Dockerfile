FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 2601

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "2601"]
