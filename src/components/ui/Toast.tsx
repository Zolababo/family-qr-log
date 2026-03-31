'use client';

/** 기존 status 문자열 색상 규칙과 유사하게 분류 (점진적 도입용) */
export function inferToastVariant(message: string): 'success' | 'error' | 'info' {
  if (message.includes('실패') || message.includes('필요') || message.includes('필요합니다')) {
    return 'error';
  }
  if (
    message.includes('수정되었습니다') ||
    message.includes('삭제되었습니다') ||
    message.includes('추가되었습니다') ||
    message.includes('저장되었습니다') ||
    message.includes('변경되었습니다') ||
    message.includes('가족 메모가 저장되었습니다') ||
    message.includes('이름이 저장되었습니다') ||
    message.includes('프로필 사진이 변경되었습니다') ||
    message.includes('로그가 추가되었습니다') ||
    message.includes('다운로드가 완료되었습니다')
  ) {
    return 'success';
  }
  return 'info';
}

export type ToastVariant = 'success' | 'error' | 'info';

type ToastProps = {
  message: string;
  fading: boolean;
  highContrast: boolean;
  /** 로그인 시 하단 탭 위로 띄움 */
  liftAboveTabBar: boolean;
  /** 지정 시 문자열 휴리스틱 대신 사용(안정적인 톤 고정) */
  variant?: ToastVariant | null;
};

export function Toast({ message, fading, highContrast, liftAboveTabBar, variant: variantProp }: ToastProps) {
  const variant: ToastVariant = variantProp ?? inferToastVariant(message);

  const palette =
    variant === 'error'
      ? {
          color: highContrast ? '#fecaca' : '#b91c1c',
          background: highContrast ? 'rgba(127,29,29,0.45)' : 'rgba(248,113,113,0.12)',
          border: highContrast ? '1px solid rgba(248,113,113,0.55)' : '1px solid rgba(248,113,113,0.4)',
        }
      : variant === 'success'
        ? {
            color: highContrast ? '#bbf7d0' : '#3f5f49',
            background: highContrast ? 'rgba(20,83,45,0.45)' : 'rgba(63,116,102,0.14)',
            border: highContrast ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(63,116,102,0.35)',
          }
        : {
            color: highContrast ? '#e2e8f0' : 'var(--text-primary)',
            background: highContrast ? '#1e1e1e' : 'var(--accent-light)',
            border: highContrast ? '1px solid #444' : '1px solid rgba(139,106,79,0.35)',
          };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: liftAboveTabBar
          ? 'max(88px, calc(56px + env(safe-area-inset-bottom, 0px) + 24px))'
          : 'max(20px, env(safe-area-inset-bottom, 0px))',
        width: 'min(480px, calc(100vw - 32px))',
        maxWidth: 'min(480px, calc(100vw - 32px))',
        zIndex: 55,
        padding: '12px 16px',
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.45,
        fontWeight: 500,
        boxShadow: highContrast ? '0 8px 28px rgba(0,0,0,0.45)' : 'var(--shadow-card)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.35s ease-out',
        wordBreak: 'break-word',
        ...palette,
      }}
    >
      {message}
    </div>
  );
}
