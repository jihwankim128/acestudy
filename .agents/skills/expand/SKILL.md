---
name: expand
description: AceStudy 토픽 풀 확장. 노트에 쌓인 토픽 제안(suggest)과 DB의 지식 그래프 빈 곳을 근거로 새 토픽을 만들고, 겹치지 않게 랜덤 배정한 뒤 curriculum PR을 올린다. 기본 토픽이 충분히 쌓이면 2단계(실전 문제) 토픽도 만든다. "토픽 추가", "주제 더 뽑아줘", "expand", "다음 단계" 같은 요청이나 study 스킬이 확장을 권장할 때 사용.
---

# expand — 토픽 풀 확장

Claude Code(`/expand`)와 Codex(`$expand`)가 함께 쓴다. 규칙은 `AGENTS.md` 를 따르고, `AGENTS.md` 의 페르소나 시선으로 "백엔드 개발자에게 지금 빠진 지식이 무엇인가"를 판단한다.

## 1. 근거 수집
```bash
git switch main && git pull
npm run context -- <내 아이디>
```
- `suggestions`: 노트들이 남긴 토픽 제안. 여러 노트에서 나온 것(`from` 이 많은 것)을 먼저 본다.
- `expand.practiceReady`: 기본 CS 5개 영역(`arch`, `os`, `net`, `ds`, `db`)의 70% 완료 여부로, 실전 학습 권장 시점을 알려준다. 설계·운영·실전·심화 주제를 기본 CS 분모에 포함하지 않는다.
- 사용자가 넓은 학습 목차나 다음 단계 추가를 요청하면 준비도와 관계없이 해당 목차를 먼저 추가할 수 있다. 배정된 세션 순서와 노트의 선행관계는 그대로 따른다.
- `curriculum/roadmap.md`: 이미 계획한 영역과 실전 토픽의 기본 연결을 확인한다. 새 영역을 추가하면 이 문서와 README의 토픽·세션 수를 함께 갱신한다.
- `studiedNotes` 의 링크: 많이 참조되는데 토픽 풀에 없는 개념, 링크가 거의 없는 고립된 영역을 찾는다.

## 2. 토픽 설계
`curriculum/topics.yaml` 에 추가한다. 기준:
- **10~20분** 안에 끝나는 크기. 크면 쪼갠다.
- **백엔드 관점** `hook` 한 줄 필수: 실제로 마주치는 상황이나 질문.
- 기존 토픽과 겹치면 안 된다. 제목이 달라도 내용이 같으면 추가하지 않는다.
- id 는 `<category>.<kebab-case>` 형식이고 한 번 정하면 바꾸지 않는다.
- 한 번에 팀원 수(3)의 배수로 추가하면 세션이 깔끔하게 나뉜다.

### 1단계: 기본 CS 보강
기존 카테고리(`arch`, `os`, `net`, `ds`, `db`)에 추가한다.

### 새 카테고리
`suggestions` 중 기존 카테고리에 없는 `category` 가 있으면 새 카테고리를 만든다.
- `categories` 에 `{ id, name, topics: [...] }` 를 추가한다.
  - 예: `dist` 분산 시스템, `concurrency` 동시성, `infra` 인프라/클라우드, `sec` 보안, `observability` 관측성
- 새 카테고리는 처음 만들 때 토픽을 팀원 수(3)의 배수로 채운다. 그래야 세션 하나를 온전히 구성한다.
- 페이지 색은 `site/style.css` 의 `--c-<id>` 에 추가한다. 없으면 기본 색으로 표시된다.
- `stage`는 선택 필드다. 예: `design`, `distributed`, `operations`, `practice`, `advanced`. 영역 구분이며 엄격한 실행 순서나 마지막 단계가 아니다. 새 단계도 추가할 수 있다.

### 실전 문제 (`practiceReady`일 때 권장, 후속 목차 요청 시 미리 추가 가능)
`practice` 카테고리를 만들고(없으면 `categories` 끝에 `{ id: practice, name: 실전 문제 }` 추가) 실제 장애·성능·설계 시나리오를 토픽으로 만든다.
- 예: `practice.connection-pool-exhaustion` — 커넥션 풀 고갈로 전체 API가 멈춘 장애
- 예: `practice.coupon-race` — 선착순 쿠폰이 수량보다 많이 발급된 버그
- `hook` 에는 **증상**을 쓴다. 원인은 학습하면서 찾는다.
- 토픽마다 연결될 기본 토픽이 2개 이상 있어야 한다. 실전 노트는 `prerequisites` 로 기본 토픽에 링크된다.
- 목차 설계 시 기본 토픽의 연결 후보를 `curriculum/roadmap.md`에 기록한다. 토픽 YAML에 강제 선행 순서를 도입하지 않는다.

### 설계와 후속 심화의 반복 확장
- 시스템 전체를 한 토픽으로 잡지 않는다. 예: 채팅 전체 설계 대신 전달 확인과 재접속, 피드 전체 설계 대신 읽기·쓰기 팬아웃.
- 실제 코드베이스가 있다면 재현 가능한 동작과 관측 증거를 바탕으로 프로젝트 문제를 만든다. 없으면 재현 가능한 가상 시나리오임을 명시하며 실제 장애를 조사한 것처럼 기록하지 않는다.
- 각 영역의 학습 결과에서 구현 → 진단 → 설계 트레이드오프 → 심화의 다음 후보를 찾는다. `advanced` 이후에도 같은 절차를 반복한다.
- 기존 노트를 읽어 `suggest`의 제안뿐 아니라 이번 사용자가 요청한 새 영역도 근거로 삼는다. 기존 목차에 동일한 내용이 있으면 연결하거나 더 작은 후속 문제를 추가한다.

## 3. 배정 + PR
```bash
git switch -c curriculum/expand-<YYYYMMDD>
npm run assign      # 기존 배정은 유지하고 새 토픽만 랜덤 배정 (세션 뒤에 추가)
npm run check
git add curriculum/
git commit -m "curriculum: 토픽 N개 추가 (<요약>)"
git push -u origin HEAD
gh pr create --base main --title "curriculum: 토픽 N개 추가" --body "<추가 토픽 표: id | 제목 | hook | 근거(제안한 노트/그래프 빈 곳)>"
```
- 다른 확장 PR과 충돌하면 main 을 rebase 한 뒤 `schedule.yaml` 은 main 버전을 쓰고 `npm run assign` 을 다시 돌린다.
- 확장은 한 번에 한 사람만 한다. 열린 `curriculum:` PR이 있으면 새로 만들지 말고 그 PR에 의견을 남긴다:
  `gh pr list --search "curriculum: in:title" --state open`
