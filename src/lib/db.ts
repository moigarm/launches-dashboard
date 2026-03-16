import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '$env/dynamic/private';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function createPrismaClient() {
	const connectionString = env.DATABASE_URL;
	if (!connectionString) {
		throw new Error('DATABASE_URL environment variable is not set');
	}

	// Decode base64 CA cert from env — no file path needed, works on any VM/container
	const sslCa = env.DATABASE_SSL_CERT
		? Buffer.from(env.DATABASE_SSL_CERT, 'base64').toString('utf-8')
		: undefined;

	const pool = new pg.Pool({
		connectionString,
		ssl: sslCa ? { ca: sslCa } : undefined,
	});
	const adapter = new PrismaPg(pool);
	return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
