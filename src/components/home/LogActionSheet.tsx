'use client';

type LogActionSheetProps = {
  /** 목록에 없으면 버튼 영역은 비움(기존 HomeClient 동작과 동일) */
  log: { id: string } | null;
  highContrast: boolean;
  t: (key: string) => string;
  onDismiss: () => void;
  onEdit: (logId: string) => void;
  onDelete: (logId: string) => void;
};

/** 로그 카드 롱프레스 후 하단 수정·삭제 액션 — 라우팅·삭제는 부모 */
export function LogActionSheet({ log, highContrast, t, onDismiss, onEdit, onDelete }: LogActionSheetProps) {
  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={onDismiss}>
      <div
        role="dialog"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 80,
          transform: 'translateX(-50%)',
          minWidth: 200,
          padding: '12px 0',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          border: '1px solid #e2e8f0',
          zIndex: 51,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {log ? (
          <>
            <button
              type="button"
              onClick={() => onEdit(log.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                border: 'none',
                background: 'none',
                fontSize: 15,
                color: highContrast ? '#ffffff' : '#0f172a',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {t('edit')}
            </button>
            <button
              type="button"
              onClick={() => onDelete(log.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                border: 'none',
                background: 'none',
                fontSize: 15,
                color: '#dc2626',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {t('delete')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
