# AceStudy — 에이전트 작업 가이드

이 저장소는 3명이 각자 AI 에이전트와 함께 CS를 학습하고, 그 결과를 쌓아가는 곳이다.
에이전트는 이 문서를 먼저 읽고 아래 규칙대로 움직인다.

## 목적

1. **AI가 학습 범위를 뽑는다** — `curriculum/roadmap.yaml`이 전체 범위(트랙 → 토픽 → 핵심 개념)다.
2. **각자 에이전트와 학습하고 노트를 push한다** — `notes/<github-id>/<topic-id>.md`.
3. **push된 노트는 자동으로 쌓인다** — GitHub Actions가 Firestore(DB)에 동기화하고, Cloudflare 페이지에 반영한다.
4. **에이전트는 쌓인 노트를 근거로(RAG) 부족한 개념을 찾아 채운다** — 아무도 안 다룬 토픽, 다뤘지만 빠진 핵심 개념이 우선이다.
5. **단계**: 1단계 기본 CS → 2단계 실무/프로젝트 시나리오(장애, 성능, 설계 트레이드오프).

## 학습 세션 절차 (`/study`)

1. `git pull --rebase` 로 최신화한다.
2. `node scripts/build-index.mjs` 를 실행하고 `site/data/gaps.json` 을 읽는다.
   - 배포된 API(`/api/gaps`)를 써도 같다.
3. 다음 토픽을 고른다. 우선순위:
   1. 아무도 다루지 않은 토픽 (`uncovered`)
   2. 다뤘지만 `missingConcepts` 가 남은 토픽
   3. 사용자가 지정한 토픽
4. 기존 노트(`notes/**/<같은 topic-id>.md`)를 먼저 읽고, **겹치지 않게** 빠진 개념을 중심으로 학습한다.
5. 사용자와 대화하며 학습한 뒤, `notes/_template/note.md` 형식으로 `notes/<github-id>/<topic-id>.md` 를 작성한다.
   - 같은 파일이 이미 있으면 덮어쓰지 말고 내용을 보강한다.
   - `concepts` 에는 roadmap의 개념 이름을 **그대로** 적는다(커버리지 계산에 쓰인다).
6. 다시 `node scripts/build-index.mjs` 로 검증한 뒤 커밋/푸시한다.
   - 커밋 메시지: `study(<topic-id>): <한 줄 요약>`
   - `main` 에 바로 push. 충돌 시 `git pull --rebase` 후 재시도.

## 규칙

- 자기 디렉터리(`notes/<본인 github-id>/`)만 수정한다. 다른 사람 노트는 읽기만.
- 새 토픽이 필요하면 `curriculum/roadmap.yaml` 에 추가하는 별도 커밋을 만든다 (`curriculum: ...`).
- 출처(공식 문서, 책, RFC 등)는 `sources` 에 남긴다. 추측은 추측이라고 쓴다.
- 비밀값(API 키, 서비스 계정 JSON)은 절대 커밋하지 않는다.

## 구조

```
curriculum/roadmap.yaml   학습 범위 (트랙/토픽/핵심개념)
notes/<github-id>/*.md    각자 학습 노트 (frontmatter + 본문)
scripts/build-index.mjs   노트 → site/data/*.json (인덱스, 커버리지, gap)
scripts/sync-firestore.mjs 노트 → Firestore 동기화 (CI에서 실행)
site/                     Cloudflare에 배포되는 정적 페이지
worker/                   Cloudflare Worker (정적 자산 + /api/*)
firebase/                 Firestore 규칙/인덱스
```
