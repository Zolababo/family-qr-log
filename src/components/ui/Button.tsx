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
  borderRadius: 12,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  transition: 'background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 100ms ease',
};

/** primary / secondary / ghost — 한 화면씩 도입; 터치 최소 높이 44px */
export function Button({ variant = 'primary', highContrast = false, style, disabled, children, ...rest }: ButtonProps) {
  const variantStyle: CSSProperties =
    variant === 'primary'
      ? {
          border: highContrast ? '2px solid #ffc107' : '1px solid var(--accent)',
          background: highContrast ? '#ffc107' : 'var(--accent)',
          color: highContrast ? '#0f0f0f' : '#fffdf9',
          fontWeight: 700,
        }
      : variant === 'secondary'
        ? {
            border: highContrast ? '2px solid #ffc107' : '1px solid var(--divider)',
            background: highContrast ? '#2a2a2a' : 'var(--bg-subtle)',
            color: highContrast ? '#ffc107' : 'var(--text-secondary)',
            fontWeight: 600,
          }
        : {
            border: 'none',
            background: 'transparent',
            color: highContrast ? '#e2e8f0' : 'var(--text-secondary)',
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
