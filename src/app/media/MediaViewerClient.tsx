'use client';

import { Download, Share2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function MediaViewerClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') === 'video' ? 'video' : 'image';
  const url = searchParams.get('url') ?? '';

  const downloadMedia = (src: string) => {
    if (typeof window === 'undefined') return;
    const a = document.createElement('a');
    a.href = src;
    a.download = '';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const shareMedia = async (src: string) => {
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({ url: src });
        return;
      } catch {
        // 사용자 취소 포함: 조용히 무시
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(src);
      } catch {
        // 권한 문제 시 무시
      }
    }
  };

  return (
    <main
      style={{
        width: '100vw',
        height: '100dvh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
      }}
    >
      {url && type === 'image' ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}
      {url && type === 'video' ? (
        <video src={url} controls autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}
      <div
        style={{
          position: 'fixed',
          right: 12,
          bottom: 12,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => void shareMedia(url)}
          aria-label="공유"
          title="공유"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            borderRadius: 999,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Share2 size={18} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => downloadMedia(url)}
          aria-label="다운로드"
          title="다운로드"
          style={{
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            borderRadius: 999,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Download size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </main>
  );
}
