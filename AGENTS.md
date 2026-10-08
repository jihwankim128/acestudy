# AceStudy — 에이전트 작업 가이드

3명이 각자 AI 에이전트와 CS를 학습하고, 결과를 **하나의 지식 그래프**로 쌓는 저장소다.
에이전트는 이 문서를 먼저 읽고 아래 절차를 따른다.
학습 세션 스킬은 `.agents/skills/study/SKILL.md` 에 있다. Codex는 `$study`, Claude Code는 `/study` 로 실행한다.
(`.claude/skills` 는 `.agents/skills` 를 가리키는 심볼릭 링크라서 두 에이전트가 같은 스킬을 쓴다.)

## 목적

- 백엔드 개발자 관점의 기본 CS를 학습한다: 컴퓨터 구조, 운영체제, 네트워크, 자료구조, 데이터베이스.
- 학습한 노트는 서로 **선행 → 후속** 링크로 연결되어 옵시디언 같은 그래프가 된다.
- 다음 단계에서는 실제 문제(장애, 성능, 설계) 기반으로 심화한다. 그때 그래프로
  "이 문제를 이해하려면 어떤 기본 지식이 필요한가"와 "이 기본 지식이 어떤 실제 사례에 쓰이는가"를 양방향으로 찾아간다.
  그래서 지금 링크를 촘촘하고 정확하게 까는 것이 노트 본문만큼 중요하다.

## 배정 규칙

- `curriculum/topics.yaml`: 토픽 풀. 토픽 하나 = 10~20분 학습 분량. 순서나 선행관계는 없다.
- `curriculum/schedule.yaml`: `npm run assign` 이 생성한 랜덤 배정표.
  - 세션 하나 = 카테고리 하나. 팀원마다 그 카테고리 안의 서로 다른 토픽을 1개씩 맡는다.
  - 토픽은 딱 한 사람에게만 배정된다 → **겹침 없음**.
- **자기에게 배정된 토픽만 학습한다.** 세션 번호가 낮은 것부터.

## 학습 세션 절차 (`/study`)

1. `git switch main && git pull`
2. `npm run context -- <내 github-id>` 실행
   - 출력: 내 다음 토픽(`next`), DB(Firestore)에 쌓인 노트 요약(`studiedNotes`), 전체 토픽 목록(`allTopics`)
3. 브랜치 생성: `git switch -c study/<topic-id>`
4. 토픽의 `hook`(백엔드 관점)에서 출발해 사용자와 10~20분 분량으로 학습한다.
   - 질문, 설명, 예제를 섞고, 마지막에 확인 질문 2~3개를 낸다.
   - 범위를 넓히지 않는다. 다른 토픽 내용이 필요하면 설명하지 말고 링크로 넘긴다.
5. 노트 작성: `notes/<category>/<topic-id>.md` (형식은 `curriculum/note-template.md`)
6. **시각화 (필수)**: `notes/<category>/<topic-id>.viz.html`
   - `curriculum/viz-template.html` 을 복사해서 시작한다. 단일 HTML, 300KB 이하.
   - 핵심 동작 과정을 단계(step) 애니메이션으로 보여준다. 학습자가 이해한 방식 그대로, 가장 헷갈렸던 장면을 넣는다.
   - 페이지의 토픽 화면에 sandbox iframe 으로 표시된다.
7. **그래프 매핑 (PR 전 필수)**: `studiedNotes` 와 `allTopics` 를 보고 링크를 채운다.
   - `prerequisites`: 이 토픽을 이해하려면 먼저 알아야 하는 토픽
   - `leads_to`: 이 지식이 쓰이거나 심화되는 토픽
   - `related`: 방향 없이 연관된 토픽
   - 아직 학습 안 된 토픽에도 링크해도 된다. 그래프를 미리 깔아두는 것이다.
   - 기존 노트의 링크와 모순이 없는지 확인한다. 예: A가 B를 선행으로 뒀다면 B도 A를 선행으로 두지 않는다.
   - 본문의 "연결" 섹션에 `[[topic-id]]` 로 각 링크가 **왜** 연결되는지 한 줄씩 쓴다.
   - 다른 사람 노트는 수정하지 않는다. 역방향 링크(백링크)는 빌드가 자동 계산한다.
8. `npm run check` 통과 확인
9. 커밋 `study(<topic-id>): <한 줄 요약>` → push → PR 생성
   - `gh pr create --fill --base main`
   - PR 본문에 추가한 링크 목록과 각 링크의 근거를 적는다.

## 규칙

- 출처(공식 문서, 책, RFC 등)를 `sources` 에 남긴다. 확실하지 않은 내용은 추측이라고 표시한다.
- 토픽 추가나 수정은 별도 PR로 한다: `topics.yaml` 수정 → `npm run assign` (기존 배정 유지, 새 토픽만 추가 배정).
- 비밀값(API 키, 서비스 계정 JSON)은 절대 커밋하지 않는다.

## 구조

```
curriculum/topics.yaml       토픽 풀 (카테고리 → 토픽, hook)
curriculum/team.yaml         팀원, 랜덤 시드
curriculum/schedule.yaml     세션별 배정표 (자동 생성)
curriculum/note-template.md  노트 템플릿
curriculum/viz-template.html 시각화 템플릿
notes/<category>/<id>.md     학습 노트 — 이 폴더를 옵시디언 vault 로 열 수 있음
notes/<category>/<id>.viz.html  노트별 시각화
.agents/skills/study/        학습 세션 스킬 (Codex / Claude Code 공용)
scripts/                     assign / build-index / context / sync-firestore
site/ + vercel.json          Vercel 페이지 + /api/*
```
