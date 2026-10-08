---
description: 다음 CS 학습 토픽을 골라 함께 학습하고 노트를 push한다
argument-hint: "[topic-id (선택)]"
---

AGENTS.md 의 "학습 세션 절차"를 따른다.

1. `git pull --rebase` 후 `node scripts/build-index.mjs` 실행, `site/data/gaps.json` 을 읽는다.
2. 내 GitHub 아이디는 `gh api user -q .login` 으로 확인한다.
3. 토픽: $ARGUMENTS 가 있으면 그것을, 없으면 gap 우선순위대로 하나 골라 이유와 함께 제안한다.
4. 같은 topic-id 의 기존 노트를 모두 읽고, 이미 다룬 것과 빠진 개념을 요약해 보여준다.
5. 빠진 개념 위주로 질문·설명·예제로 학습을 진행한다. 마지막에 확인 퀴즈 3개.
6. `notes/<내 아이디>/<topic-id>.md` 를 템플릿 형식으로 작성/보강하고, 인덱스 재빌드로 검증한 뒤
   `study(<topic-id>): ...` 로 커밋하고 push한다.
