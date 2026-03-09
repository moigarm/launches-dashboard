import bcrypt from 'bcryptjs';
import { prisma } from './db';

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export async function createUser(email: string, password: string, name?: string) {
	const hashedPassword = await hashPassword(password);
	
	return prisma.user.create({
		data: {
			email,
			password: hashedPassword,
			name
		}
	});
}

export async function authenticateUser(email: string, password: string) {
	const user = await prisma.user.findUnique({
		where: { email }
	});

	if (!user) {
		return null;
	}

	const isValid = await verifyPassword(password, user.password);
	
	if (!isValid) {
		return null;
	}

	// Return user without password
	const { password: _, ...userWithoutPassword } = user;
	return userWithoutPassword;
}

export async function createDefaultUser() {
	// Create default user: user / password
	const existingUser = await prisma.user.findUnique({
		where: { email: 'user@example.com' }
	});

	if (!existingUser) {
		await createUser('user@example.com', 'password', 'Default User');
		console.log('Default user created: user@example.com / password');
	}
}
