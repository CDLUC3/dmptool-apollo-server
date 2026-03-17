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
