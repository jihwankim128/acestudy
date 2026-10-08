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
                       Firestore (notes/topics/edges)          Cloudflare 페이지 (그래프 · 노트 · 시각화)
```

- **범위(1단계)**: 컴퓨터 구조 · 운영체제 · 네트워크 · 자료구조 · 데이터베이스. 66개 토픽을 백엔드 관점(`hook`)으로 정리했다.
- **배정**: 한 세션에서는 3명이 같은 카테고리의 서로 다른 토픽을 하나씩 맡는다. 총 22세션이다. → [`curriculum/schedule.yaml`](curriculum/schedule.yaml)
- **그래프**: 노트마다 `prerequisites` / `leads_to` / `related` 링크와 본문의 `[[topic-id]]` 가 엣지가 된다. 아직 학습하지 않은 토픽도 노드로 미리 깔아둔다.
- **2단계**: 실제 문제(장애, 성능, 설계) 기반 심화. 그래프를 따라 필요한 기본 지식을 찾고, 반대로 기본 지식이 쓰인 사례로도 이동한다.

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

## 관리자 설정 (GitHub Secrets)

| Secret | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 (Edit Cloudflare Workers 템플릿) |
| `CLOUDFLARE_ACCOUNT_ID` | `5a4c89337fcfbe7c371fe2f62e2acafb` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase `acestudy-cs` 서비스 계정 키 JSON 전체 |
