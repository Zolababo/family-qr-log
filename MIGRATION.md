# Family QR Log — 진행 내역 마이그레이션 (Context 이어가기용)

---

## 0. "새 채팅에서 이어하기" — 매우 상세한 방법 (처음 보시면 여기부터 읽으세요)

### 0-1. 왜 이게 필요한가요?
- Cursor 채팅은 **Context used(사용한 맥락)** 가 쌓이면 한도에 가까워집니다.
- 한도에 가까우면 **예전 대화를 덜 참고**하게 되어, "아까 하던 작업", "어디까지 했지?" 가 새 채팅에서는 흐려질 수 있습니다.
- 그래서 **진행 내역을 이 파일(MIGRATION.md)에 적어 두고**, **새 채팅을 열었을 때 이 파일을 같이 보여 주면**, AI가 "지금 프로젝트 상태"와 "지금까지 뭘 했는지"를 바로 알아서 이어서 도와줄 수 있습니다.

---

### 0-2. 새 채팅을 연 다음, 정확히 무엇을 하면 되나요?

**방법 A: @ 로 파일 붙이기 (추천)**

1. Cursor 왼쪽 **채팅 아이콘**을 눌러 **새 채팅**을 엽니다.
2. 채팅 **입력창**을 클릭합니다.
3. **영문 @** 를 입력합니다.
4. 목록에서 **MIGRATION.md** 를 선택합니다.
5. 입력창에 `@MIGRATION.md` 가 붙은 상태에서, **한 줄로 하고 싶은 일**을 씁니다. 예:
   - `이 파일 보고 지금 프로젝트 상태 이어받아서, [하고 싶은 작업] 해줘`
6. **Enter**로 전송합니다.

**정리**: 새 채팅에서 **@ → MIGRATION.md 선택 → 하고 싶은 일 적기 → 전송** 하면, AI가 이 파일을 기준으로 이어서 답합니다.

---

**방법 B: 파일을 열어 둔 상태로 질문하기**

1. **MIGRATION.md** 를 에디터에서 연다.
2. 새 채팅에 `지금 열어둔 MIGRATION.md 기준으로 이어서 [작업] 해줘` 처럼 보낸다.
3. 가능하면 입력창에 **`@MIGRATION.md`** 붙이면 더 확실하다.

---

### 0-3. "이어서 한다"는 게 구체적으로 무슨 뜻인가요?
- **이 파일에 적힌 내용** = 지금까지의 결정, 건드린 파일, 알려진 한계.
- 새 채팅에서 이 파일을 붙이면, **코드·배포·다음 작업**을 이 맥락에 맞춰 이어갈 수 있다.

---

### 0-4. 한 줄 요약
- **Context가 많이 쌓였을 때** → **새 채팅** + **`@MIGRATION.md`** + **하고 싶은 일**을 짧게 보낸다.

---

## 1. 프로젝트 요약

- **스택**: Next.js 16, React 19, Supabase (Auth, DB, Storage), Vercel 배포
- **기능**: 가족 로그(텍스트·사진·영상), QR(게스트/첫 방문), 멤버 필터, 댓글·답글, 캘린더, 가족 메모 패널, PWA, 다국어(ko/en/ja/zh)
- **제품 방향 (v2)**: QR은 **게스트·첫 방문** 위주. **가족은 홈에서 바로 기록**. 기록 분류는 **선택 태그**(DB 컬럼명만 레거시로 `place_slug`, 값은 일반·멤버·주제 슬러그).
- **주요 파일**: `src/app/HomeClient.tsx` (메인 UI·상태), `src/lib/logTags.ts` (슬러그·필터), `src/lib/logMedia.ts` (`getLogMedia`), `src/lib/formatDateTime.ts`, `src/components/home/LogTagFilterRow.tsx`, `LogFeed.tsx`, `CommentSheet.tsx`, `StickerPickerSheet.tsx`, `NameEditModal.tsx`, `AccessibilitySettingsModal.tsx`, `FamilyMemoPanel.tsx`, `EnlargedAvatarOverlay.tsx`, `src/lib/accessibilityFont.ts`, `src/app/globals.css`, `src/app/translations.ts`
- **롤백 참고**: Git 태그 **`v1.0`** = 이전(장소 중심) UI 스냅샷이 있으면 원복 비교용으로 사용 가능.

---

## 2. 최근 완료한 작업 (이어서 할 때 참고)

### 2-1. 디자인 토큰 (`globals.css`)
- 라이트/따뜻한 테마 토큰: `--bg-*`, `--text-*`, `--accent`, 장소별 `--place-fridge` 등
- `HomeClient`의 `theme` 객체, 칩·버튼 등이 CSS 변수와 맞춰져 있음
- 로그 태그 칩: `.log-tag-chip.general` … `todo` (주제). DB 컬럼명은 레거시로 `place_slug`(값은 태그 슬러그).

### 2-2. PWA
- `public/manifest.webmanifest`, `public/icon.png` 사용 중. 아이콘은 사용자가 `public/icon.png`로 교체 가능.

### 2-3. v2 가족 로그 UX (2026-03 — **현재 홈 기준**)

| 항목 | 설명 |
|------|------|
| **슬러그·필터** | `src/lib/logTags.ts` — `LOG_SLUG`(general, fridge, table, toilet, health, diet, kid, pet, todo), `filterSlugForQuery`, `PLACE_SLUGS` / `TOPIC_SLUGS` |
| **피드 필터** | `LogTagFilterRow` — 상단에 **「목록에서 보기」** 라벨. 전체/일반/멤버·주제 태그 칩으로 **아래 로그 목록만** 필터 |
| **홈 컴포저** | 로그인 시 **항상** 한 줄 입력 + **올리기**. **가족 메모** 카드(공지·장보기·루틴): 기본은 **읽기**, **편집/완료**로 입력 |
| **이번 글 태그** | 가로 스크롤 칩: 일반 + 주제 + 장소. **접기 없음** (예전 `+` 패널 제거) |
| **음성** | 텍스트 옆 **마이크 아이콘**만 (Web Speech API, 브라우저별 지원) |
| **QR 탭** | `qrTabGuest` 문구: 게스트/첫 방문용 안내. **가족은 홈에서 기록** |
| **URL `?place=`** | 로그인 사용자: `LOG_SLUG` 전체에 매칭되면 태그 프리필 후 URL 정리 |

**로컬 저장(중요)**  
- 가족 공지 / 장보기 / 루틴은 **`localStorage`** (`family_qr_log_notice` 등). **기기·브라우저마다 다름**; Supabase 동기화는 **아직 없음**.  
- 다음 단계로 하려면 Supabase 테이블 + RLS 또는 기존 `household_memos` 확장 검토.

### 2-4. 예전과 달라진 점 (문서 정리용)
- **홈 상단 냉장고·식탁·화장실 전용 버튼(`PlaceButtons`)** 으로 “장소 먼저 고르기” 하던 흐름은 **홈에서 제거**됨. 컴포넌트 파일 `PlaceButtons.tsx`는 저장소에 남아 있을 수 있으나 **현재 홈 플로우에는 미사용**.
- **시간대 추천 태그** UI는 제거됨 (`getSuggestedSlugsByHour`는 라이브러리에 남겨둘 수 있으나 UI 미사용).

### 2-5. 그대로 유지되는 기능 (요약)
- HEIC 프로필 변환, 댓글·대댓글, 캘린더·성장 타임라인, 메모 패널, 지도 로그 메타(`@@meta`), 미디어 업로드, 다국어

---

## 3. 알려진 이슈 / 남은 작업

- **배포 후 화면이 안 바뀌는 것처럼 보일 때**: 브라우저·PWA 캐시 삭제, 또는 Vercel 배포 완료 여부 확인. `globals.css`/`HomeClient` 인라인 혼용 시 캐시 이슈가 있었음 → 지금은 변수·테마 정리됨.
- **Context used가 높을 때**: 새 채팅 + **`@MIGRATION.md`** (섹션 0).
- **가족 메모(공지·장보기·루틴)**: 현재 **로컬만**. 가족 간 공유하려면 DB 설계 필요.
- **스티커 / 남의 로그 수정**: `logs` RLS·`@@meta` 구조는 `DEPLOY.md`·SQL 참고. 반응 전용 테이블 분리는 미래 개선안.
- **스크롤 단계별 연출**(프로필→장소→로그): 요청 이력 있음, 미완.
- **아기 얼굴·성장 타임라인 고도화**: MVP·개인정보 검토 필요.

---

## 4. 배포 방법 (상기용)

1. 변경 스테이징 → 커밋 → **`git push origin main`**
2. Vercel이 `main` 푸시 감지 후 자동 배포
3. 환경 변수: Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등 (`.env.local`은 Git에 없음)
4. CLI: `npx vercel --prod` (로그인된 경우)

---

## 5. 다음에 이어서 할 때 말하면 좋은 문장 예시

- "`@MIGRATION.md` 보고 지금 상태 이어서 [원하는 작업] 해줘"
- "가족 메모를 Supabase로 올려서 가족끼리 동기화해줘"
- "피드 필터와 이번 글 태그가 헷갈리지 않게만 더 다듬어줘"

---

## 6. 현재 스냅샷 (2026-03 후반 — 새 채팅 이어가기용)

**아키텍처**
- 메인: `src/app/HomeClient.tsx`
- 태그/필터: `src/lib/logTags.ts`
- 홈: `src/components/home/LogTagFilterRow.tsx`, `LogFeed.tsx`, `src/components/layout/AppHeader.tsx`, `BottomTabBar.tsx`, `MemberFilter.tsx`
- 스타일: `src/app/globals.css`
- 문자열: `src/app/translations.ts` (키 예: `familyBoardTitle`, `feedFilterTitle`, `nextPostTagLabel`, `qrTabGuest`, `logGeneral`, `topicHealth` …)

**UI/UX (현재)**
- **목록에서 보기**: 피드 필터 칩. **이번 글 태그**: 다음 로그에 붙는 `place_slug` 선택
- **가족 메모 카드**: 공지·장보기·루틴 — 읽기/편집, 내용은 로컬 기기에만 저장
- **올리기** 버튼 문구 (`quickPost`), 빠른 문구, 사진·영상·지도 메타(접기) 등 기존 유지

**배포**
- GitHub `main` 푸시 → Vercel 자동 배포. 최근 커밋 예: `feat` 가족 로그 v2 UX, `fix` 홈 UI 단순화(가족 메모 카드 등).

**다음에 손대기 좋은 것**
- 가족 메모·장보기·루틴을 **household 단위 DB**로 동기화
- `PlaceButtons.tsx` 미사용이면 정리(삭제 또는 문서화) 여부 결정
- 반응·공지·피드 상단 고정 등 제품 요구사항 반영

---

## 7. 변경 이력 (요약 로그)

| 시점 | 내용 |
|------|------|
| 2026-03 초 | 디자인 토큰, PWA, 멤버/로그 UI 다듬음 |
| 2026-03 중 | v2 UX: QR 게스트 안내, 주제/일반 슬러그, `logTags`, LogTagFilterRow, 홈 컴포저 대개편 |
| 2026-03 후 | 홈 단순화: 가족 메모 카드(읽기/편집), 피드·태그 라벨 구분, 음성 아이콘, 추천 태그 UI 제거 |

---

*마지막 업데이트: 2026-03-21 — v2 UX·가족 메모·로컬 한계·파일·롤백·이력 섹션 반영.*
