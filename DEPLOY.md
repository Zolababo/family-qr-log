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
   ```

2. **Storage 버킷 생성**  
   - Storage → New bucket → 이름: `log-images`  
   - Public bucket 체크 (또는 RLS로 읽기 허용)  
   - 버킷 정책에서 `log-images`에 대한 insert/update는 인증된 사용자만 허용하도록 설정

## 7. 자주 쓰는 명령어 요약

| 목적           | 명령어 |
|----------------|--------|
| 상태 확인      | `git status` |
| 변경사항 스테이징 | `git add .` |
| 커밋           | `git commit -m "메시지"` |
| 푸시(배포 반영) | `git push origin main` |
| 최신 받기      | `git pull origin main` |
