// 문제은행 분류. Toss 스터디(문항)와 Toss 노트(노트의 [[c1]] 링크 이름)가 같이 쓴다.
import { CODING, QUIZ, DESIGN, CONCEPT } from '/toss/questions.js';

export const pad = (n) => String(n).padStart(2, '0');
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// 시험 시간 배분(주관식 5문항 25분, 서술형 2문항 30분)에 맞춘 분류.
// 주관식은 문항당 5분짜리 짧은 서술이 본체이고, 키워드는 용어·숫자형 대비용이다.
export const GROUPS = [
  { id: 'coding', name: '코딩', label: '코딩', color: '--c-arch', kind: 'coding', items: CODING },
  { id: 'short', name: '주관식 · 서술', label: '주관식', color: '--c-os', kind: 'text', items: CONCEPT },
  { id: 'keyword', name: '주관식 · 키워드', label: '키워드', color: '--c-net', kind: 'quiz', items: QUIZ },
  { id: 'essay', name: '서술형 · 설계', label: '서술형', color: '--c-db', kind: 'text', items: DESIGN },
];
export const ORDER = GROUPS.flatMap((g) => g.items.map((item, i) => ({ item, group: g, no: i + 1 })));
export const byId = new Map(ORDER.map((e) => [e.item.id, e]));
export const titleOf = ({ item, group }) => (group.kind === 'coding' ? item.title : plain(item.q));
// 노트의 [[c1]] 같은 문항 링크에 붙일 이름
export const questionLabel = (id) => { const e = byId.get(id); return e ? `${e.group.label} ${pad(e.no)}` : null; };
