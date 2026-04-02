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
- **주요 파일**: `src/app/HomeClient.tsx` (메인 UI·상태), `src/lib/logTags.ts` (슬러그·필터), `src/lib/logMedia.ts` (`getLogMedia`), `src/lib/formatDateTime.ts`, `src/components/home/LogTagFilterRow.tsx`, `LogFeed.tsx`, `CommentSheet.tsx`, `StickerPickerSheet.tsx`, `NameEditModal.tsx`, `AccessibilitySettingsModal.tsx`, `FamilyMemoPanel.tsx`, `EnlargedAvatarOverlay.tsx`, `LogActionSheet.tsx` (로그 롱프레스 수정·삭제), `src/lib/accessibilityFont.ts`, `src/app/globals.css`, `src/app/translations.ts`
- **롤백 참고**: Git 태그 **`v1.0`** = 이전(장소 중심) UI 스냅샷이 있으면 원복 비교용으로 사용 가능.

---

## 2. 최근 완료한 작업 (이어서 할 때 참고)

### 2-1. 디자인 토큰 (`globals.css`)
- 라이트/따뜻한 테마 토큰: `--bg-*`, `--text-*`, `--accent`, 장소별 `--place-fridge` 등
- **§5 `--v0-*`:** v0 제안명 **별칭**(현재는 기존 토큰과 동일 연결, 시각 무변). 상세·원안 색은 `docs/v0-design-tokens-reference.md`
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

**로컬 + 원격(가족 메모)**  
- 앱은 **`household_memos`**(content, family_notice, shopping_list, updated_at)로 upsert + Realtime·폴링; 테이블이 없거나 RLS/스키마 오류 시 **`logs` 스냅샷**(`@@meta`류) 또는 로컬 **`localStorage`** 로 폴백.  
- **배포 시:** `scripts/add-household-memos-board-columns.sql` → `household-memos-updated-at.sql`(트리거) → **`enable-household-memos-rls-policies.sql`** 순서 권장. Realtime에 `household_memos` 포함 확인.

### 2-4. 예전과 달라진 점 (문서 정리용)
- **홈 상단 냉장고·식탁·화장실 전용 버튼**으로 “장소 먼저 고르기” 하던 흐름은 **홈에서 제거**됨. 예전 전용 컴포넌트 `PlaceButtons.tsx`는 **미사용으로 삭제**(Git 이력에 남음).
- **시간대 추천 태그** UI는 제거됨 (`getSuggestedSlugsByHour`는 라이브러리에 남겨둘 수 있으나 UI 미사용).

### 2-5. 그대로 유지되는 기능 (요약)
- HEIC 프로필 변환, 댓글·대댓글, 캘린더·성장 타임라인, 메모 패널, 지도 로그 메타(`@@meta`), 미디어 업로드, 다국어

### 2-6. 가계부 (ledger, 2026-04)
- 하단 탭 **가계부** → `LedgerPanel` + `useHouseholdLedger` (`src/features/ledger/`).
- **Supabase 적용 순서 (운영 DB):** (1) `scripts/ledger-entries-migration.sql` — 테이블·RLS·인덱스. (2) `scripts/enable-ledger-realtime-publication.sql` — `supabase_realtime`에 `ledger_entries` 추가(가족 간 즉시 반영). **(1) 후 (2)** 순서 권장. (2)만 실행해도 테이블이 없으면 의미 없음. 스크립트 상단 주석·**`DEPLOY.md` §7** 참고.
- **프로덕션 DB에 반드시 적용:** 위 (1). Supabase SQL Editor에서 한 번 실행. 미적용 시 목록/저장 시 에러 메시지가 표시됨.
- 금액은 **원 단위 정수**(`amount_krw`), 수입/지출(`direction`), 날짜(`occurred_on`), 동일 household 멤버만 접근.
- 분류(`category`)는 **영문 slug**(`food`, `transport`, …)로 저장하고, UI만 언어별 번역. 예전 한글 프리셋 행은 표시 시 매핑. **연필**로 내역 수정, **휴지통**으로 삭제.
- **다른 기기·가족과 즉시 동기화:** `useHouseholdLedger`가 `ledger_entries`에 Realtime 구독함. Supabase에서 한 번 실행: `scripts/enable-ledger-realtime-publication.sql` (테이블을 `supabase_realtime` publication에 추가). Dashboard **Database → Publications**에서 `ledger_entries`가 포함돼 있는지 확인 가능.
- **캘린더 연동:** 월 그리드에 해당 일 가계부 건수(지갑 아이콘) 표시. 날짜 선택 시 **이 날 가계부** 블록 + **가계부에서 입력**으로 가계부 탭 이동 시 날짜 필드 프리필(`CalendarDayLedgerSection`, `LedgerPanel.occurredOnPrefill`).
- **가계부 월 보기:** 집계 카드·목록은 **선택한 연·월** 기준(◀ ▶). 첫 로드는 최근 **300건** 스냅샷, 월 변경 시 해당 월은 **Supabase에서 `occurred_on` 범위로 추가 조회**해 병합(로컬 캐시 상한 `LEDGER_MERGED_MAX`는 코드에서 조정 가능).
- **가계부 CSV:** 보고 있는 달의 목록을 UTF-8(BOM) CSV로 내려받기 (`ledger-YYYY-MM.csv`).
- **가계부 UX:** 월 ◀▶ 전환 시 입력 **날짜**는 이번 달이면 오늘, 과거·미래 달이면 그 달 **1일**로 맞춤(편집 중 제외). **이 달 지출 · 분류**로 지출만 카테고리별 합계 표시(행 구분선·고대비 시 노란 테두리·제목 대비·`role="region"`).
- **캘린더 헤더:** 월 제목은 `language`에 맞춰 `toLocaleDateString` (년+월).

### 2-7. 할 일 (todo)
- `TodoBoard` + `logs` 스냅샷 동기화. 항목에 선택적 **`dueDate`** (YYYY-MM-DD) — 입력란 위 **기한** `type="date"`, 미입력 가능.
- 사분면 내 활성 목록은 **기한 오름차순**(기한 없음은 뒤). 기한이 **오늘 이전**이면 미완료 시 **지연** 표시.
- 활성 항목 **연필**로 내용·기한 수정(저장/취소). 캘린더: 해당 일 **마감 미완료** 건수(보라 톤 체크 아이콘) + 날짜 상세에 **이 날 마감 할 일** 블록(`CalendarDayTodoSection`). **할 일 탭으로** 시 **긴급·중요** 칸 기한란에 해당 날짜 프리필(`dueDatePrefill`).

---

## 3. 알려진 이슈 / 남은 작업

- **배포 후 화면이 안 바뀌는 것처럼 보일 때**: 브라우저·PWA 캐시 삭제, 또는 Vercel 배포 완료 여부 확인. `globals.css`/`HomeClient` 인라인 혼용 시 캐시 이슈가 있었음 → 지금은 변수·테마 정리됨.
- **Context used가 높을 때**: 새 채팅 + **`@MIGRATION.md`** (섹션 0).
- **가족 메모**: 코드상 **동기화 시도**는 있음 (`household_memos`). 프로젝트에 테이블·**RLS·`updated_at` 트리거**가 없으면 폴백만 동작 — `scripts/` SQL 적용 여부 확인.
- **스티커 / 남의 로그 수정**: `logs` RLS·`@@meta` 구조는 `DEPLOY.md`·SQL 참고. 반응 전용 테이블 분리는 미래 개선안.
- **댓글(`log_comments`) RLS**: 테이블·초기 RLS는 **`DEPLOY.md` §8**. 수정·삭제 불가 등 정책 꼬임은 `scripts/enable-log-comments-rls-policies.sql` 실행(백업 후) — 절차는 **같은 절** 하단 “RLS 오류” 참고.
- **스크롤 단계별 연출**(프로필→장소→로그): 홈 탭에 **섹션 페이드(`ScrollReveal`, 스크롤 루트 기준 IO)** + 가로 칩 **`scroll-snap: x proximity`** 적용(2026-04). 전체 뷰포트 스냅·스크롤 잠금은 없음.
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
- 홈: `src/components/home/LogTagFilterRow.tsx`, `LogFeed.tsx`, `LogFeedSkeleton.tsx`, `src/components/layout/AppHeader.tsx`, `BottomTabBar.tsx`, `MemberFilter.tsx`
- 공통 UI(소규모): `src/components/ui/Toast.tsx`, `src/components/ui/Empty.tsx`, `src/components/ui/Badge.tsx` (`LogTagBadge`), `src/components/ui/Button.tsx` (`primary` | `secondary` | `ghost` — 점진 도입)
- 스타일: `src/app/globals.css`
- 문자열: `src/app/translations.ts` (키 예: `familyBoardTitle`, `feedFilterTitle`, `nextPostTagLabel`, `qrTabGuest`, `logGeneral`, `topicHealth` …)

**UI/UX (현재)**
- **목록에서 보기**: 피드 필터 칩 + **`feedFilterHint`** 안내(선택 태그가 목록·새 글 태그에 같이 적용됨). **이번 글 태그**: 다음 로그에 붙는 `place_slug` 선택
- **가족 메모 카드**: 공지·장보기·루틴 — 읽기/편집; **`household_memos` + RLS** 적용 시 가족 간 동기화(미적용 시 로컬·로그 폴백)
- **올리기** 버튼 문구 (`quickPost`), 빠른 문구, 사진·영상·지도 메타(접기) 등 기존 유지
- **로딩/피드백 (점진 도입)**: `LogFeedSkeleton` — 최초 로그 로드 + 당겨서 새로고침 중 홈 피드 자리 표시. `Toast` — `status` 문자열 + **`setAppStatus(msg, tone?)`** (`HomeClient.tsx`): 두 번째 인자로 `success` | `error` | `info` 고정(생략 시 `inferToastVariant(msg)`). `Empty` — 빈 화면 문구: `LogFeed`, 검색 탭, 캘린더 날짜 상세, 「오늘의 회상」; `tone="caption"` 보조 스타일

### 세션 인수인계 (끊김 없이 이어가기)

**에이전트/사람이 새 채팅을 열었을 때 할 일**
1. 이 파일 `MIGRATION.md`를 **`@MIGRATION.md`** 로 붙인다.
2. 아래 **「이번 세션에서 한 일」** 을 최신 커밋 기준으로 갱신한다 (또는 사용자에게 확인).
3. **안정성 체크리스트**를 건드린 작업마다 훑는다.

**이번 세션에서 한 일 (최근)**
- **문서:** `DEPLOY.md` §8 댓글 RLS 정비(`enable-log-comments-rls-policies.sql`) 안내; `enable-log-comments-rls-policies.sql` 헤더에 선행 조건·문서 참조.
- **문서:** `DEPLOY.md` §7 가계부 절차 추가; `ledger-entries-migration.sql` / `enable-ledger-realtime-publication.sql` 헤더에 선행·참조 주석; `MIGRATION.md` §2-6에 `DEPLOY.md` §7 링크.
- **홈 UX:** `feedFilterHint` — 피드 필터 칩 위에 “목록 + 새 글 태그” 연동 안내; `LogTagFilterRow`에 `ariaDescribedBy` 옵션.
- **`usePrefersReducedMotion`:** `useSyncExternalStore`로 갱신(움직임 줄이기 설정을 첫 클라이언트 렌더에서 반영).
- **문서:** `MIGRATION.md` — `log_comments` RLS 스크립트 안내·§3 진척도 표 보정.
- **홈 모션:** `ScrollReveal` — 가족 메모·피드 필터·오늘 요약·`LogFeed`가 스크롤로 들어올 때만 약한 페이드; `globals.css` **`.home-chip-scroll-snap`** — 로그/캘린더 태그 칩 가로 proximity 스냅.
- **접근성:** `usePrefersReducedMotion` — 홈 스티키 헤더·당겨서 새로고침 높이·가족 메모/피드 필터 `details` 화살표·`FamilyMemoPanel` 슬라이드에 **`prefers-reduced-motion: reduce` 시 transition 비활성**.
- **문서:** `MIGRATION.md` — 진척도(%) 기준 표·가계부 Supabase **(1)→(2)** 적용 순서 정리.
- **가계부:** `LedgerPanel` — **이 달 지출 · 분류** 카드 고대비·구역 레이블(`aria-labelledby`)·카테고리 행 구분선.
- **v0 토큰(로드맵 8/8):** `globals.css`에 `--v0-*` 별칭(기존 토큰 참조), `docs/v0-design-tokens-reference.md` 상태 문구 갱신.
- (이전) `PlaceButtons` 삭제, `household_memos` SQL 등.

**다음 우선순위 (로드맵 표 §6)**  
- **표 8단계 완료.** 이후는 제품 백로그(반응·피드 고정 등) 또는 `--v0-*` 실제 색 치환(디자인 합의 후).

### 진척도 (한눈에 — “몇 %?”에 쓰는 기준)

| 무엇을 세나요? | 진행률 | 설명 |
|----------------|--------|------|
| **§6 로드맵 표 8단계** (Empty·Toast·Badge·Button·마이크로·household_memos 스크립트·PlaceButtons·v0 별칭) | **100%** | 표에 적힌 8항목은 모두 완료. |
| **가계부·할 일·캘린더 연동** (앱 코드·다국어) | **~100%** | 레포 기준 기능 구현 완료. |
| **Supabase SQL** (가계부·가족 메모 등) | **운영별** | 스크립트는 레포에 있음. **프로덕션에 실행했는지**에 따라 “실제로 켜진 기능” 비율이 달라짐(미적용 시 앱은 폴백·에러 안내). |
| **§3 백로그** (성장 타임라인 고도화·반응·피드 고정 등) | **대부분 미착수** | 홈 **스크롤 페이드·가로 칩 스냅**은 반영됨(2026-04). 나머지는 우선순위별. |

**한 줄 감각:** “정해 둔 UI 로드맵”은 **100%**. “핵심 가족 앱(로그+가계부+할 일)” **코드**는 **대략 90~95%**처럼 보는 경우가 많고(남는 건 주로 **DB 스크립트 적용·운영**), **§3까지 전부** 넣으면 %는 **낮아짐** — 비교할 때 **위 표의 행**을 같이 말하면 혼동이 줄어듦.

### 진척도 (§6 로드맵 표 8단계 기준)

| 구분 | 내용 |
|------|------|
| **완료** | **8 / 8** (100%) — 로드맵 표 전부: 마지막은 **`globals.css` §5 `--v0-*` 별칭** + 문서 갱신(시각 동일). |
| **남은 표상 단계** | **없음** — 이후는 제품 우선순위·선택적 v0 색 치환. |
| **참고** | 표 밖 제품 요구(반응·피드 고정 등)는 별도. |

**안정성·보안 체크리스트**
- 사용자에게 보이는 문구는 **가능하면 `translations` + `t()`** — 4국어 키 누락 금지.
- Toast·피드백·Empty는 **텍스트 노드만** (HTML 주입 경로 없음).
- 홈 알림은 **`setAppStatus(msg, tone?)`** 만 사용(내부 `setStatusInternal` 직접 호출 금지 — 톤 불일치 방지).
- UI만 바꿀 때는 `setState`/API/RLS **호출을 추가·변경하지 않았는지** 확인.
- Supabase SQL(`scripts/*.sql`)은 **스테이징·백업 후** 적용; 프로덕션은 별도 절차.

**배포**
- GitHub `main` 푸시 → Vercel 자동 배포. 최근 커밋 예: `feat` 가족 로그 v2 UX, `fix` 홈 UI 단순화(가족 메모 카드 등).

**다음에 손대기 좋은 것 (안정성·보안 우선, 한 단계씩)**

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | ~~`Empty` 검색·캘린더·회상~~ | 완료 — 일러스트/CTA는 추후 |
| 2 | ~~`Toast` `setAppStatus` + `variant`~~ | 완료 |
| 3 | ~~`LogTagBadge` (`Badge.tsx`)~~ | 완료 — `LogFeed`·캘린더 일별·검색 텍스트 목록 |
| 4 | ~~**Button** (`NameEditModal`부터)~~ | 완료 — `ghost`는 추후 화면에서 |
| 5 | ~~**마이크로 인터랙션** (1차: CSS만)~~ | 완료 — 탭 콘텐츠 페이드는 미적용(리마운트 회피) |
| 6 | ~~가족 메모 **RLS + updated_at 트리거** (스크립트)~~ | 레포 반영 완료 — **프로덕션 적용**은 별도 |
| 7 | ~~`PlaceButtons.tsx`~~ | 삭제(미사용) |
| 8 | ~~**v0 토큰** `globals` 별칭(`--v0-*`)~~ | §5 추가, 시각 무변 — 이후 색 치환은 선택 |

- 반응·공지·피드 상단 고정 등 제품 요구사항은 별도 우선순위

---

## 7. 변경 이력 (요약 로그)

| 시점 | 내용 |
|------|------|
| 2026-03 초 | 디자인 토큰, PWA, 멤버/로그 UI 다듬음 |
| 2026-03 중 | v2 UX: QR 게스트 안내, 주제/일반 슬러그, `logTags`, LogTagFilterRow, 홈 컴포저 대개편 |
| 2026-03 후 | 홈 단순화: 가족 메모 카드(읽기/편집), 피드·태그 라벨 구분, 음성 아이콘, 추천 태그 UI 제거 |
| 2026-03 말 | 홈 피드 Skeleton(최초·pull-refresh), `Toast`로 `status` 표시, `Empty` 도입(LogFeed 빈 상태) |
| 2026-03 말 | `Empty` 검색·캘린더·오늘의 회상 + 검색 무결과 문구, `MIGRATION` 세션 인수인계 섹션 |
| 2026-03 말 | `Toast` 명시 톤: `setAppStatus`, `statusToastTone`, `Toast` `variant` prop |
| 2026-03 말 | `LogTagBadge` (`Badge.tsx`) — 피드·캘린더·검색 태그 칩 |
| 2026-03 말 | `Button` 프리미티브 + `NameEditModal`, 진척도(4/8) 정리 |
| 2026-03 말 | 마이크로 인터랙션 1차 (`globals` + `prefers-reduced-motion`), 진척도 5/8 |
| 2026-03 말 | `household_memos` RLS 스크립트 + `updated_at` 트리거, 진척도 6/8, 메모 동기화 문서 정정 |
| 2026-03 말 | `PlaceButtons.tsx` 삭제, 진척도 7/8 |
| 2026-03 말 | v0 `--v0-*` 별칭 `globals.css` §5, 문서 갱신, 로드맵 표 **8/8 완료** |

---

*마지막 업데이트: 2026-04-02 — DEPLOY 댓글 RLS §8·가계부 §7·SQL 헤더; 피드 `feedFilterHint`; `usePrefersReducedMotion` sync; 홈 페이드·칩 스냅; 진척도·가계부 순서; 지출·분류 카드 UX.*
