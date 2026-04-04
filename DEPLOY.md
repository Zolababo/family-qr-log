# 배포를 위한 Git 사용법

## 1. 저장소 처음 만들 때 (로컬 → GitHub/GitLab)

```bash
# 프로젝트 폴더에서
git init
git add .
git commit -m "Initial commit: Family QR Log"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/family-qr-log.git
git push -u origin main
```

## 2. 이미 원격 저장소가 있을 때 (연결만)

```bash
git remote add origin https://github.com/YOUR_USERNAME/family-qr-log.git
git branch -M main
git push -u origin main
```

## 3. 이후 배포용 커밋 & 푸시

```bash
git add .
git status
git commit -m "메시지 예: 밝은 테마 적용, QR 스캔 개선"
git push origin main
```

## 4. Vercel로 배포할 때

- **방법 A**: [vercel.com](https://vercel.com) 로그인 → "Add New Project" → GitHub 저장소 선택 → 배포 (이후 `git push`만 하면 자동 재배포)
- **방법 B**: Vercel CLI로 한 번 배포
  ```bash
  npx vercel
  ```
  프로덕션 배포:
  ```bash
  npx vercel --prod
  ```

## 5. 환경 변수 (Supabase 등)

- `.env.local` 은 Git에 올라가지 않음 (`.gitignore`에 있음)
- Vercel 대시보드: Project → Settings → Environment Variables 에서
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 등 추가

## 6. 사진 로그 사용 시 (Supabase)

로그에 사진을 올리려면 Supabase에서 다음 설정이 필요합니다.

1. **logs 테이블에 컬럼 추가**  
   SQL Editor에서 실행:
   ```sql
   ALTER TABLE logs ADD COLUMN IF NOT EXISTS image_url TEXT;
   -- 여러 사진 + 영상 지원 (선택)
   ALTER TABLE logs ADD COLUMN IF NOT EXISTS image_urls TEXT;
   ALTER TABLE logs ADD COLUMN IF NOT EXISTS video_url TEXT;
   ```
   (`image_urls`는 JSON 배열 문자열 예: `["url1","url2"]`, `video_url`은 영상 URL 한 개)

2. **Storage 버킷 생성**  
   - Storage → New bucket → 이름: `log-images`  
   - Public bucket 체크 (또는 아래 정책으로 읽기 허용)

3. **Storage 업로드/읽기 허용 (RLS 정책)**  
   사진 업로드 시 "new row violates row-level security policy" 가 나오면, Supabase **SQL Editor**에서 아래를 **한 번에 실행**하세요.
   ```sql
   -- 로그인한 사용자만 log-images 버킷에 업로드 허용
   CREATE POLICY "Allow authenticated upload to log-images"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'log-images');

   -- 누구나 log-images 버킷에서 조회(이미지 보기) 허용
   CREATE POLICY "Allow public read log-images"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'log-images');
   ```
   이미 같은 이름 정책이 있다는 에러가 나오면, Supabase **Storage → log-images → Policies** 에서 수동으로 위와 같은 규칙을 추가하면 됩니다.

### 프로필 사진 사용 시 (선택)

헤더/필터에 보이는 **프로필 원형 사진**을 등록·수정하려면 아래를 **순서대로** 하면 됩니다.

---

#### ① members 테이블에 컬럼 추가

1. Supabase 대시보드 왼쪽에서 **SQL Editor** 클릭  
2. **New query** 클릭 후 아래 SQL을 붙여넣고 **Run** 실행  
   ```sql
   ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
   ```

---

#### ② Storage에 avatars 버킷 만들기

1. Supabase 대시보드 왼쪽에서 **Storage** 클릭  
2. **New bucket** 버튼 클릭  
3. **Name**에 `avatars` 입력 (정확히 이 이름으로)  
4. **Public bucket** 체크박스 **체크** (프로필 사진을 앱에서 보이게 하려면 꼭 체크)  
5. **Create bucket** 클릭  

---

#### ③ Storage 정책(권한) 추가 — "이걸 어떻게 하라는 거지?"

버킷만 만들면 프로필 사진 업로드가 막혀 있어서, **Supabase에게 "avatars 버킷은 이렇게 쓰게 해줘"라고 알려주는 단계**입니다.  
방법은 **SQL Editor에서 코드 한 번 실행**하는 것입니다.

**하는 방법 (한 줄 요약: SQL Editor 열고 → 아래 코드 통째로 붙여넣고 → Run 누르기)**

1. Supabase 화면 **왼쪽 메뉴**에서 **SQL Editor**를 클릭합니다.
2. **New query** 버튼을 누르면, 가운데에 **빈 칸(코드 입력창)**이 나옵니다.
3. **아래 회색 칸 안의 코드 전체**를 드래그해서 복사합니다. (`CREATE POLICY`부터 마지막 `;`까지 전부.)
4. 2번의 **빈 칸**에 **붙여넣기**(Ctrl+V 또는 Cmd+V) 합니다.
5. 오른쪽 아래 **Run** 버튼(또는 Ctrl+Enter)을 누릅니다.
6. 아래쪽에 **Success** 또는 **No rows returned** 같은 문구가 나오면 **끝**입니다.  
   - "policy already exists" 라고 나와도, 이미 설정된 거라 **무시**하시면 됩니다.

**여기 있는 코드를 통째로 복사해서 SQL Editor에 붙여넣고 Run 하면 됩니다.**

```sql
CREATE POLICY "Allow authenticated upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public read avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated update avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');
```

---

위 ①·②·③을 모두 끝내면 앱에서 ☰ 메뉴 → **프로필 사진 변경**으로 사진을 등록·수정할 수 있습니다.

**프로필 사진이 업로드 후 깨져 보일 때**
- 앱에서는 이제 **이미지 로드에 실패하면 깨진 아이콘 대신 이름 첫 글자(이니셜)**가 표시됩니다.
- 실제 사진이 보이게 하려면: Storage에서 `avatars` 버킷이 **Public**으로 설정되어 있는지 확인하세요.
- Supabase 대시보드 → Storage → avatars → 설정에서 "Public bucket"이 켜져 있어야 합니다.

## 7. 가계부 (`ledger_entries`) 사용 시

앱 하단 **가계부** 탭에서 수입·지출을 쓰려면 Supabase에 테이블과 RLS가 있어야 합니다. **백업 후**, 아래 순서로 **SQL Editor**에서 실행하세요.

1. **필수** — 레포의 `scripts/ledger-entries-migration.sql` 파일 내용을 통째로 복사해 실행합니다. (`ledger_entries` 테이블 + RLS 등)
2. **선택** — 가족 구성원끼리 **다른 기기에서 바로 반영**되게 하려면 `scripts/enable-ledger-realtime-publication.sql` 을 실행합니다. (`supabase_realtime` publication에 테이블 추가; 1번 없이 2번만 하면 의미 없습니다.)

자세한 동작·한계는 **`MIGRATION.md` §2-6** 을 참고하세요.

## 8. 로그 댓글 (답글 포함) 사용 시

로그에 댓글·답글을 쓰려면 Supabase에서 **댓글용 테이블**을 한 번 만들어 두어야 합니다.

### Supabase에서 하는 방법 (이미 SQL Editor 탭을 열었다면)

1. **Supabase 대시보드** → 왼쪽 메뉴에서 **SQL Editor** 클릭 (이미 여기 있다면 그대로 진행)
2. **New query** 버튼을 누르거나, 가운데 빈 입력 칸을 클릭합니다.
3. 아래 **전체 SQL**을 복사합니다 (```sql 부터 ``` 까지 전부).
4. SQL Editor의 입력 칸에 **붙여넣기** 합니다.
5. 오른쪽 아래 **Run** 버튼(또는 Ctrl+Enter)을 눌러 실행합니다.
6. 아래쪽에 **Success. No rows returned** 같은 메시지가 나오면 완료입니다.  
   - "relation already exists" 는 이미 테이블이 있다는 뜻이라 그대로 두면 됩니다.

이렇게 한 번만 실행해 두면, 앱에서 로그에 댓글·답글을 쓸 수 있습니다.

```sql
-- log_comments 테이블 (로그당 댓글, 댓글당 답글)
CREATE TABLE IF NOT EXISTS log_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES log_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_comments_log_id ON log_comments(log_id);
CREATE INDEX IF NOT EXISTS idx_log_comments_parent_id ON log_comments(parent_id);

ALTER TABLE log_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read log_comments"
  ON log_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert log_comments"
  ON log_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### 댓글·답글 수정·삭제가 안 되거나 RLS 오류가 날 때

위 SQL만 적용했는데 **본인 댓글 수정/삭제가 막히거나**, 정책이 꼬였다면 레포의 **`scripts/enable-log-comments-rls-policies.sql`** 을 SQL Editor에서 **통째로 실행**해 정책을 정비하세요. (`log_comments` 테이블이 이미 있어야 합니다.) 자세한 설명은 **`MIGRATION.md` §3** 과 해당 스크립트 상단 주석을 참고합니다.

## 9. 자주 쓰는 명령어 요약

| 목적           | 명령어 |
|----------------|--------|
| 상태 확인      | `git status` |
| 변경사항 스테이징 | `git add .` |
| 커밋           | `git commit -m "메시지"` |
| 푸시(배포 반영) | `git push origin main` |
| 최신 받기      | `git pull origin main` |

## 10. 운영 DB — 한 번에 점검할 순서 (밤톨이네 이야기)

**백업 후** Supabase **SQL Editor**에서 필요한 것만 순서대로 실행하세요. 이미 적용된 단계는 스크립트가 `IF NOT EXISTS` 등으로 대부분 건너뛰거나, "already exists"면 무시해도 됩니다.

| 순서 | 기능 | 할 일 |
|------|------|--------|
| 1 | 로그 미디어·Storage | 위 **§6** (logs 컬럼, `log-images` 버킷·정책) |
| 2 | 프로필 사진 (선택) | **§6** 하단 ①②③ (`avatars`) |
| 3 | 가족 메모 동기화 | `household_memos` 테이블이 **이미 있어야** 합니다. 그다음 레포 순서: `scripts/add-household-memos-board-columns.sql` → `scripts/household-memos-updated-at.sql` → `scripts/enable-household-memos-rls-policies.sql`. Realtime 쓰려면 Dashboard **Database → Replication** 에서 `household_memos` 포함 여부 확인 (**`MIGRATION.md` §2-3**). |
| 4 | 가계부 | **§7**: `scripts/ledger-entries-migration.sql` → (선택) `scripts/enable-ledger-realtime-publication.sql`. Publications에 `ledger_entries` 포함 여부 확인. |
| 5 | 댓글·답글 | **§8**로 `log_comments` 테이블·기본 RLS. 수정·삭제가 막히면 `scripts/enable-log-comments-rls-policies.sql` 추가 실행. |
| 6 | 태그 데이터 정리 (선택) | 기존 `logs.place_slug` 값을 v2 슬러그로 맞출 때만 `scripts/migrate-logs-place-slug-canonical.sql` (적용 전 데이터 백업·검토). |
| 7 | RLS 점검 (읽기 전용) | `scripts/rls-baseline-production-checklist.sql` — 정책 목록 확인용 쿼리. 실행으로 스키마를 바꾸지는 않습니다. |

**배포 후 앱이 예전처럼 보일 때**: 브라우저·PWA 캐시 삭제, Vercel 배포 완료 여부 확인 (**`MIGRATION.md` §3**).
