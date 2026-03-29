'use client';

/** 빈 목록/빈 상태용 블록(텍스트만 — 안전한 기본) */
export function Empty({ message, captionColor }: { message: string; captionColor: string }) {
  return (
    <div
      style={{
        padding: '18px 16px',
        fontSize: 13,
        color: captionColor,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
