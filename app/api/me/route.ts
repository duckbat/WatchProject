import { getChatGPTUser, chatGPTSignOutPath, chatGPTSignInPath } from '../../chatgpt-auth';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ user: null, signInPath: chatGPTSignInPath('/') }, { headers: { 'Cache-Control': 'no-store' } });
  return Response.json(
    { user: { name: user.fullName, email: user.email, displayName: user.displayName }, signOutPath: chatGPTSignOutPath('/') },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
