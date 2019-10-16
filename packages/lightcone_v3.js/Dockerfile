FROM node:10.16

# Add files
ADD tsconfig.json ./tsconfig.json
ADD globals.d.ts ./globals.d.ts
ADD package.json ./package.json

ADD src ./src
ADD test ./test

# Build package
RUN npm install && npm run dev
