'use client';

import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  variant?: ButtonVariant;
  /** 접근성 고대비 모드 — 테두리·채움 조정 */
  highContrast?: boolean;
  children: React.ReactNode;
};

const base: CSSProperties = {
  minHeight: 44,
  minWidth: 44,
  boxSizing: 'border-box',
  borderRadius: 10,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 14px',
};

/** primary / secondary / ghost — 한 화면씩 도입; 터치 최소 높이 44px */
export function Button({ variant = 'primary', highContrast = false, style, disabled, children, ...rest }: ButtonProps) {
  const variantStyle: CSSProperties =
    variant === 'primary'
      ? {
          border: 'none',
          background: highContrast ? '#ffc107' : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          color: highContrast ? '#0f0f0f' : '#fff',
          fontWeight: 600,
        }
      : variant === 'secondary'
        ? {
            border: highContrast ? '2px solid #ffc107' : '1px solid #e2e8f0',
            background: highContrast ? '#2a2a2a' : '#f1f5f9',
            color: highContrast ? '#ffc107' : '#64748b',
            fontWeight: 500,
          }
        : {
            border: 'none',
            background: 'transparent',
            color: highContrast ? '#e2e8f0' : '#64748b',
            fontWeight: 500,
          };

  return (
    <button
      type="button"
      style={{
        ...base,
        ...variantStyle,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.75 : 1,
        ...style,
      }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
