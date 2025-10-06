FROM node:22.20.0

# Install required libraries for Puppeteer/Chrome
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install specific libnspr4 version to fix Puppeteer/Chrome issues
RUN wget http://ftp.us.debian.org/debian/pool/main/n/nspr/libnspr4_4.39-1_amd64.deb && \
    dpkg -i libnspr4_4.39-1_amd64.deb && rm libnspr4_4.39-1_amd64.deb

# Ensure the .so.1 symlink exists
RUN ln -sf /usr/lib/x86_64-linux-gnu/libnspr4.so /usr/lib/x86_64-linux-gnu/libnspr4.so.1

# App setup
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000

CMD ["node", "dist/index.js"]
