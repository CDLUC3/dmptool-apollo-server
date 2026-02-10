# Dockerfile
# preferred node version chosen here (22.1.0-alpine3.19 as of 05/04/2024)
FROM public.ecr.aws/docker/library/node:22.22-alpine3.23

# Install MariaDB and Bash so we can run data-migrations/process.sh
RUN apk update && \
    apk add --no-cache \
    mysql-client \
    mariadb-connector-c \
    aws-cli \
    bash \
    python3 \
    py3-pip

# Create the directory on the node image
# where our Next.js app will live
RUN mkdir -p /app

# Set /app as the working directory in container
WORKDIR /app

# Install awslocal so we can build AWS resources in localstack
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir awscli-local

# Copy package.json and package-lock.json
# to the /app working directory
COPY package*.json tsconfig.json codegen.ts .env ./

# Install dependencies in /app
RUN npm ci

# Copy the rest of our Apollo Server folder into /app
COPY . .

# Ensure port 3000 is accessible to our system
EXPOSE 4000

# Command to run the Next.js app in development mode
CMD ["npm", "run", "dev"]
