import { auth } from '$lib/auth';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Get session from BetterAuth
	const session = await auth.api.getSession({ headers: event.request.headers });
	
	// Add session to locals for easy access in routes
	event.locals.session = session;
	event.locals.user = session?.user;

	// Protected routes that require authentication
	const protectedRoutes = ['/dashboard', '/poor-performers'];
	const isProtectedRoute = protectedRoutes.some(route => event.url.pathname.startsWith(route));

	// Redirect to login if accessing protected route without session
	if (isProtectedRoute && !session) {
		throw redirect(302, '/login');
	}

	// Redirect to dashboard if accessing login/register with active session
	if ((event.url.pathname === '/login' || event.url.pathname === '/register') && session) {
		throw redirect(302, '/dashboard');
	}

	return resolve(event);
};
