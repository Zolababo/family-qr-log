'use client';

/** 빈 목록/빈 상태용 블록(텍스트만 — 안전한 기본) */
export function Empty({
  message,
  captionColor,
  tone = 'default',
}: {
  message: string;
  captionColor: string;
  /** caption: 보조 영역(12px) / default: 본문(13px) */
  tone?: 'default' | 'caption';
}) {
  const isCaption = tone === 'caption';
  return (
    <div
      style={{
        padding: isCaption ? '12px 16px' : '18px 16px',
        fontSize: isCaption ? 12 : 13,
        lineHeight: isCaption ? 1.45 : 1.5,
        color: captionColor,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
