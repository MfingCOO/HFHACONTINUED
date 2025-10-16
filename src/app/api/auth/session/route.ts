
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

// This route handles session management.
// It receives a token from the client, creates a session cookie, and returns it.
// Or, if logged out, it clears the cookie.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Missing Authorization header', {status: 401});
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return new Response('Missing bearer token', {status: 401});
  }

  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  const response = new NextResponse(JSON.stringify({status: 'success'}), {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });

  // The 'session' cookie is set here. It's secure and httpOnly.
  response.cookies.set({
    name: 'session',
    value: idToken,
    httpOnly: true,
    secure: true,
    maxAge: expiresIn,
    path: '/',
  });

  return response;
}

// This handles logout.
export async function GET(request: NextRequest) {
  const response = new NextResponse(JSON.stringify({status: 'success'}), {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });

  // Clear the session cookie.
  response.cookies.set({
    name: 'session',
    value: '',
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: '/',
  });

  return response;
}
