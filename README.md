# AceStudy

백엔드 개발자 3명이 각자 AI 에이전트(Codex / Claude Code)와 CS를 학습하고, 학습 결과를 **하나의 지식 그래프**로 쌓아가는 스터디.

## 흐름

```
 topics.yaml ──(npm run assign)──▶ schedule.yaml      카테고리 안에서 랜덤 배정, 토픽 중복 없음
                                       │
              각자 에이전트 /study ◀──────┘
                 │  ① DB에 쌓인 노트 조회 (npm run context)
                 │  ② 10~20분 학습
                 │  ③ 노트 + 시각화 작성
                 │  ④ 선행/후속 링크 매핑 → 그래프에 연결
                 ▼
              Pull Request ──(CI: npm run check)──▶ merge
                                                      │
                               ┌──────────────────────┴──────────────────────┐
                               ▼                                             ▼
                       Firestore (notes/topics/edges)          Vercel 페이지 (그래프 · 노트 · 시각화)
```

- **범위**: 기본 CS 72개와 시스템 설계 · 분산 시스템 · 운영 · 관측 · 성능 · 실전 문제 · 심화 60개, 총 132개 토픽. 각 토픽은 10~20분 분량이며 백엔드 관점(`hook`)에서 시작한다. → [`학습 영역과 확장 목차`](curriculum/roadmap.md)
- **배정**: 한 세션에서는 3명이 같은 카테고리의 서로 다른 토픽을 하나씩 맡는다. 현재 44세션이며, 기존 22세션 뒤에 새 배정을 추가했다. → [`curriculum/schedule.yaml`](curriculum/schedule.yaml)
- **그래프**: 노트마다 `prerequisites` / `leads_to` / `related` 링크와 본문의 `[[topic-id]]` 가 엣지가 된다. 아직 학습하지 않은 토픽도 노드로 미리 깔아둔다.
- **확장**: 토픽 풀은 고정이 아니다. 학습 중 나온 제안(`suggest`)과 그래프 빈 곳을 근거로 `expand` 스킬이 새 토픽을 추가하고 랜덤 배정한다.
- **다음 단계**: 기본 CS 이후에는 운영 증거를 읽고, 분산 처리와 시스템 설계를 익히고, 실제 코드베이스의 증상에서 원인을 찾은 뒤 심화로 이어간다. 기본 CS 70%는 실전 학습 권장 기준이며, 실전 목차는 미리 준비할 수 있다. 권장 연결은 [`roadmap.md`](curriculum/roadmap.md)에 있고 실제 선행·후속 링크는 학습 노트에서 확정한다.
- **계속 확장**: 마지막 카테고리가 학습의 끝은 아니다. 매 세션의 `suggest`를 모아 새로운 토픽과 필요한 카테고리를 추가한다. 새 목차에도 구현 실험 · 진단 · 설계 판단 · 후속 심화를 연결하고, 배정된 토픽을 마치면 `$expand`로 다음 배정을 만든다.

## 팀원 시작하기

```bash
git clone https://github.com/jihwankim128/acestudy.git
cd acestudy && npm install
npm run context -- <내-github-id>     # 내 다음 토픽 확인
```

에이전트에서 학습 시작:

| 에이전트 | 실행 |
|---|---|
| Codex | `$study` (또는 "공부 시작하자") |
| Claude Code | `/study` |

토픽 추가는 `$expand` / `/expand`, 팀원 PR 리뷰는 `$review` / `/review` 로 한다.

에이전트 페르소나는 `AGENTS.md` 맨 위에 있다. "폰 노이만, 앨런 튜링 급의 컴퓨터 초고수"가 제1원리와 소크라테스식 질문으로 가르친다.

두 에이전트 모두 `AGENTS.md` 와 같은 스킬(`.agents/skills/study/SKILL.md`)을 사용한다.

## 노트 = 옵시디언 vault

`notes/` 폴더를 옵시디언에서 vault로 열면 `[[topic-id]]` 링크가 그대로 그래프로 보인다.
노트마다 `<topic-id>.viz.html`(단계별 애니메이션 시각화)이 함께 있고, 웹 페이지에서는 노트 화면에 임베드된다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run context -- <id>` | 내 다음 토픽 + DB에 쌓인 노트 (에이전트용) |
| `npm run check` | 노트 검증: 담당자, 토픽, 링크, 시각화 |
| `npm run dev` | 로컬 페이지 (http://localhost:8787) |
| `npm run assign` | 토픽 추가 후 새 토픽만 배정 |

API: `/api/graph`, `/api/notes`, `/api/schedule`

## 배포

- 페이지: Vercel GitHub 연동 (main 머지 = 프로덕션, PR = 미리보기 URL)
- DB: main 머지 시 GitHub Actions 가 Firestore 동기화

### GitHub Secrets

| Secret | 값 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase `acestudy-cs` 서비스 계정 키 JSON 전체 |
