import { rewrite } from '@vercel/functions';

export const config = {
  matcher: '/',
};

export default function middleware(request: Request) {
  const url = new URL(request.url);

  if (url.hostname === 'cv.tung.mockingbird.team') {
    url.pathname = '/academic';
    return rewrite(url);
  }
}
