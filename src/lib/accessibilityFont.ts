/** 접근성 글자 크기 슬라이더 단계 (0=87.5% … 7=200%) */
export const FONT_STEPS = [0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.75, 2] as const;

export type FontScaleStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
