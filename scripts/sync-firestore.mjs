// main 머지 후 CI에서 노트·토픽·엣지를 Firestore 에 동기화한다. (FIREBASE_SERVICE_ACCOUNT = 서비스 계정 JSON)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { loadTopics, loadSchedule, loadNotes, buildGraph } from './lib/notes.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT 없음 — Firestore 동기화 건너뜀');
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const notes = await loadNotes();
const { topics, edges } = buildGraph(await loadTopics(), await loadSchedule(), notes);

const writer = db.bulkWriter();
for (const n of notes) writer.set(db.collection('notes').doc(n.topic), { ...n, syncedAt: FieldValue.serverTimestamp() });
for (const t of topics) writer.set(db.collection('topics').doc(t.id), t);

// 엣지는 노트에서 파생되므로 전부 지우고 다시 쓴다
const old = await db.collection('edges').listDocuments();
old.forEach((d) => writer.delete(d));
await writer.flush();
for (const e of edges) writer.set(db.collection('edges').doc(`${e.source}__${e.type}__${e.target}`), e);
await writer.close();

console.log(`Firestore: notes ${notes.length}, topics ${topics.length}, edges ${edges.length}`);
