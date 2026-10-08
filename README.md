# AceStudy

AI 에이전트와 함께 CS를 학습하고, 그 기록을 팀이 함께 쌓아가는 스터디 저장소.

## 어떻게 돌아가나

```
 AI가 학습 범위 생성          각자 에이전트와 학습          GitHub push (main)
 curriculum/roadmap.yaml ──▶  /study  ──▶  notes/<id>/*.md ──▶  GitHub Actions
                                  ▲                               │
                                  │                     ┌─────────┴─────────┐
                     gap / 기존 노트 (RAG)              ▼                   ▼
                                  │              Firestore (DB)     Cloudflare (페이지 + /api)
                                  └──────────────────────────────────────────┘
```

1. **범위**: AI가 뽑은 학습 범위가 `curriculum/roadmap.yaml` 에 있다. (트랙 → 토픽 → 핵심 개념)
2. **학습**: 각자 에이전트에서 `/study` 를 실행하면, 아직 아무도 안 했거나 빠진 개념이 있는 토픽을 골라 함께 학습한다.
3. **기록**: 결과를 `notes/<github-id>/<topic-id>.md` 로 남기고 `main` 에 push한다.
4. **축적**: push하면 자동으로 Firestore(DB)에 동기화되고 Cloudflare 페이지에 반영된다.
5. **보완**: 에이전트는 쌓인 노트와 커버리지(`/api/gaps`)를 보고 부족한 개념을 다음 학습으로 제안한다.

**로드맵**: 1단계 기본 CS(자료구조·알고리즘·OS·네트워크·DB·컴퓨터구조·보안·설계) → 2단계 실무/프로젝트 시나리오.

## 팀원 세팅 (5분)

```bash
git clone https://github.com/jihwankim128/acestudy.git
cd acestudy
npm install
npm run build        # 현재 커버리지/gap 확인
```

그다음 Claude Code(또는 다른 에이전트)를 이 폴더에서 열고:

```
/study               # 다음 토픽 자동 추천 후 학습
/study os.sync       # 특정 토픽 지정
```

- Claude Code는 `CLAUDE.md` → `AGENTS.md` 를 자동으로 읽는다.
- 다른 에이전트(Codex, Cursor 등)는 `AGENTS.md` 를 읽게 하면 된다.
- 규칙: 자기 폴더(`notes/<내 아이디>/`)만 수정, 커밋은 `study(<topic-id>): 요약`.

## 구조

| 경로 | 역할 |
|---|---|
| `curriculum/roadmap.yaml` | 학습 범위 |
| `notes/<github-id>/` | 각자 학습 노트 (`notes/_template/note.md` 참고) |
| `scripts/build-index.mjs` | 노트 → 인덱스/커버리지/gap JSON |
| `scripts/sync-firestore.mjs` | 노트 → Firestore |
| `site/`, `worker/` | Cloudflare Worker로 배포되는 페이지와 `/api/*` |
| `.github/workflows/deploy.yml` | push 시 빌드 → Firestore 동기화 → 배포 |

## API

- `GET /api/gaps` — 아무도 안 한 토픽, 빠진 개념
- `GET /api/coverage` — 토픽별 커버리지
- `GET /api/notes` — 전체 노트

## 관리자 설정 (GitHub Secrets)

| Secret | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 (Workers 편집 권한) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 JSON 전체 |
