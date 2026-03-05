# Dockerfile
# https://docs.aws.amazon.com/linux/al2023/ug/base-container.html
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install MariaDB and Bash so we can run data-migrations/process.sh
# Also some system utilities for testing
RUN rm -fr /var/cache/dnf/* && dnf clean all && dnf -y update && dnf -y install \
  net-tools \
  wget \
  tar \
  unzip \
  man \
  vim \
  procps-ng \
  awscli \
  findutils \
  mariadb-connector-c \
  mariadb1011 \
  nodejs22 \
  && dnf clean all

# Create the directory on the node image
# where our Next.js app will live
RUN mkdir -p /app

# Set /app as the working directory in container
WORKDIR /app

# Copy package.json and package-lock.json
# to the /app working directory
COPY package*.json tsconfig.json codegen.ts .env ./

# Copy the rest of our Apollo Server folder into /app
COPY . .

# Install dependencies in /app
RUN npm ci

# Ensure port 3000 is accessible to our system
EXPOSE 4000

# Command to run the Next.js app in development mode
CMD ["npm", "run", "dev"]
