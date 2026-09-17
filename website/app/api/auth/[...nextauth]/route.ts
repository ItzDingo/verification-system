import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';

// Define the handler
const handler = NextAuth(authOptions);

// Export GET and POST methods with explicit typing
export { handler as GET, handler as POST };