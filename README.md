# Local Database and App Setup

Here are the complete step-by-step instructions for getting your local SvelteKit dashboard project up and running with `pnpm`, Docker for PostgreSQL, and Prisma.

### 1. Check Node.js Version
Before getting started, make sure you have Node.js installed. You can check your version by running:
```bash
node -v
```
If you don't have Node.js installed (this was built using `v24.14.0`), download it from the [official site](https://nodejs.org/en/download/) or use a version manager like `nvm`.

### 2. Install `pnpm` Globally
If you don't already have `pnpm` installed, install it globally via `npm`:
```bash
npm install -g pnpm
```

### 3. Copy the Environment File
Create your local environment file by copying the provided example. In your terminal, run the following at the root of your project:
```bash
cp .env.example .env
```
Once copied, open your `.env` file. You should see the database URL is already set to work out-of-the-box with the local Docker setup `DATABASE_URL="postgresql://user:password@localhost:5432/launch_dashboard"`.

You can leave the database URL as is and replace the other API keys (like Better Auth secrets, X API keys, etc.) with your actual values.

### 4. Install Dependencies
Now that you have `pnpm` installed, install all required Node.js dependencies defined in your `package.json`:
```bash
pnpm install
```

### 5. Spin Up the Database Container Only
Open a terminal under db/ to find `docker-compose.yml` which configures the PostgreSQL database:
```bash
docker-compose up -d
```

This will launch a PostgreSQL 16 container running in the background (`-d`) on your default local machine's port **5432**.

### 6. Initialize the Database with Prisma
Once dependencies are installed and the database is running, set up your tables and generate the Prisma Client.

First, sync your Prisma schema with the database (this creates the tables in your running container):
```bash
pnpm prisma db push
```

Next, generate the Prisma Client so you get full TypeScript support in your SvelteKit code:
```bash
pnpm prisma generate
```

### 7. Verify and Start Your SvelteKit App
Now that the database is running, the schema maps have been pushed, and the dependencies are successfully installed, you can spin up your local development server:
```bash
pnpm dev
```
By default, the Vite dev server will host your SvelteKit application on **http://localhost:5173**. Open that URL in your browser to verify that everything is running nicely!
