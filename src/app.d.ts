// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				user: {
					id: string;
					email: string;
					name: string | null;
					image: string | null;
					emailVerified: boolean;
					createdAt: Date;
					updatedAt: Date;
				};
				session: {
					id: string;
					userId: string;
					expiresAt: Date;
					token: string;
					ipAddress: string | null;
					userAgent: string | null;
					createdAt: Date;
					updatedAt: Date;
				};
			} | null;
			user: {
				id: string;
				email: string;
				name: string | null;
				image: string | null;
				emailVerified: boolean;
				createdAt: Date;
				updatedAt: Date;
			} | undefined;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
