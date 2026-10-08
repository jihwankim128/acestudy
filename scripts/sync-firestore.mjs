// 노트/커버리지를 Firestore에 upsert 한다. CI에서 FIREBASE_SERVICE_ACCOUNT(JSON 문자열)로 실행.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { loadRoadmap, loadNotes, computeCoverage } from './lib/notes.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT 없음 — Firestore 동기화 건너뜀');
  process.exit(0);
}

initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const roadmap = await loadRoadmap();
const notes = await loadNotes();
const { coverage } = computeCoverage(roadmap, notes);

const batch = db.batch();
for (const note of notes) {
  batch.set(db.collection('notes').doc(note.id.replace('/', '__')), {
    ...note,
    syncedAt: FieldValue.serverTimestamp(),
  });
}
for (const topic of coverage) {
  batch.set(db.collection('topics').doc(topic.id), topic);
}
await batch.commit();
console.log(`Firestore 동기화: notes ${notes.length}, topics ${coverage.length}`);
