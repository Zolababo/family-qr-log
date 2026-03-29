# v0 제안 디자인 토큰 (참고용 · 미적용)

> **상태:** 레포에 보관만 함. `globals.css` / 기존 `--accent` 등과 **아직 통합하지 않음**. 적용 전에 라이트·고대비·접근성 글자 크기와 충돌 여부를 검토할 것.

## 컬러 시스템 (제안)

```css
:root {
  /* Primary - 따뜻한 코럴 (가족의 따뜻함) */
  --primary: #E07A5F;
  --primary-light: #FEF0ED;

  /* Secondary - 차분한 세이지 그린 */
  --secondary: #81B29A;
  --secondary-light: #E8F4EE;

  /* Accent - 골든 옐로우 (알림, 강조) */
  --accent: #F2CC8F;

  /* Neutrals */
  --bg-base: #FAF9F7;
  --bg-card: #FFFFFF;
  --text-primary: #2D3436;
  --text-secondary: #636E72;
  --text-muted: #B2BEC3;

  /* Border & Divider */
  --border: #E5E5E5;
  --divider: #F0F0F0;
}
```

## 폰트 (제안)

```css
/* 한글 최적화 폰트 */
--font-heading: 'Pretendard', sans-serif;
--font-body: 'Pretendard', sans-serif;
```

(Pretendard는 웹폰트 로딩 정책과 함께 도입 검토.)

## 크기 시스템 (제안)

```css
--text-h1: 1.75rem;   /* 28px - 페이지 타이틀 */
--text-h2: 1.25rem;   /* 20px - 섹션 타이틀 */
--text-body: 1rem;    /* 16px - 본문 */
--text-caption: 0.875rem; /* 14px - 캡션, 시간 */
--text-small: 0.75rem;    /* 12px - 보조 정보 */
```

## 출처

v0.dev UI 제안 스크랩. 실제 제품 토큰은 `src/app/globals.css` 및 테마 객체를 우선한다.
