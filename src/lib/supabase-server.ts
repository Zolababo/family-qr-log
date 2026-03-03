// @ts-nocheck
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseServer() {
  // 서버 컴포넌트에서 사용할 수 있는 Supabase 클라이언트 (현재 MVP에서는 사용 안 함)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieStore = cookies();
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const cookieStore = cookies();
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          const cookieStore = cookies();
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
