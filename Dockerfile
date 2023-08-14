FROM oven/bun:0.7.3

WORKDIR /app

# copy package.json and its lockfile
COPY ["package.json", "bun.lockb", "./"]

# install the dependencies
RUN HUSKY=0 bun install --frozen-lockfile

# copy source file
COPY . .

# run the bot
CMD ["bun", "run", "src/index.ts"]
