import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';
import bcrypt from 'bcryptjs';

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: 'postgresql'
	}),
	emailAndPassword: {
		enabled: true,
		async hashPassword(password: string) {
			return bcrypt.hash(password, 10);
		},
		async verifyPassword(password: string, hash: string) {
			return bcrypt.compare(password, hash);
		}
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
			enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
		}
	},
	secret: process.env.BETTER_AUTH_SECRET || 'your-secret-key-change-this-in-production',
	trustedOrigins: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']
});
