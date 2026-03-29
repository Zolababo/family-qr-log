'use client';

type EnlargedAvatarOverlayProps = {
  imageUrl: string;
  onClose: () => void;
};

/** 멤버 프로필 탭 시 전체화면으로 보는 이미지 (배경·이미지 탭으로 닫기) */
export function EnlargedAvatarOverlay({ imageUrl, onClose }: EnlargedAvatarOverlayProps) {
  return (
    <div
      role="dialog"
      aria-label="프로필 사진 확대"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        touchAction: 'manipulation',
      }}
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt=""
        style={{
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          objectFit: 'contain',
          display: 'block',
        }}
        onClick={onClose}
      />
    </div>
  );
}
