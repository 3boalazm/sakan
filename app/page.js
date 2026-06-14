'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('sakan_token');
    router.replace(token ? '/home' : '/auth');
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--primary)'}}>
      <div className="text-4xl font-bold" style={{color:'var(--gold)'}}>سكن</div>
    </div>
  );
}
