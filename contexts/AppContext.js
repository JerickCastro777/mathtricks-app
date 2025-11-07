// contexts/AppContext.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, set, get, update } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, loginUser, registerUser } from '../firebase/firebaseConfig.js';
import Toast from 'react-native-toast-message';
import { generarLote } from '../IA/chatGPTConfig';

/** ================== FECHAS / PREFS KEYS ================== **/
const tz = 'America/Bogota';
const todayYMD = () => {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('es-CO', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const K_HC = 'pref:highContrast';
const K_RM = 'pref:reduceMotion';
const K_PL = 'pref:preloadNext';

/** ================== GAMIFICACIÓN LIMITES ================== **/
const DEFAULT_LIVES = 5;
const MAX_LIVES_CAP = 10;
const DEFAULT_RECOVERY_MIN = 120;
const MIN_RECOVERY_MIN = 30;
const DEFAULT_ATTEMPTS = 2;
const MAX_ATTEMPTS_CAP = 3;

/** ================== POOL LOCAL (compat) ================== **/
const POOL_CAP = 60;
const POOL_MIN = 8;

/** ================== NORMALIZACIÓN / HASH ================== **/
const asArray = (v) => (Array.isArray(v) ? v : []);
const normalizeQuestion = (q = {}, fallbackLevel, fallbackCat) => {
  const type = q.type === 'matching' || q.tipo === 'emparejamiento' ? 'matching' : 'multiple';
  return {
    type,
    level: (q.level ?? fallbackLevel) || '',
    category: (q.category ?? fallbackCat) || '',
    question: q.question ?? q.pregunta ?? q.instructions ?? q.instrucciones ?? '',
    options: asArray(q.options ?? q.opciones),
    left: asArray(q.left ?? q.izquierda),
    right: asArray(q.right ?? q.derecha),
    pairs: Array.isArray(q.pairs ?? q.respuestas) ? (q.pairs ?? q.respuestas) : [],
    answer: q.answer ?? q.respuesta ?? '',
    explanation: q.explanation ?? q.explicacion ?? '',
  };
};
const makeHash = (q) => {
  try {
    const s = JSON.stringify({
      type: q.type,
      cat: q.category,
      lev: q.level,
      q: q.question || q.instructions,
      a: q.answer || q.pairs,
      o: q.options || q.left || q.right,
    });
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  } catch {
    return String(Date.now());
  }
};

/** ================== CONTEXTO ================== **/
export const AppContext = React.createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const [highContrast, _setHighContrast] = useState(false);
  const [reduceMotion, _setReduceMotion] = useState(false);
  const [preloadNext, _setPreloadNext] = useState(false);

  /** Pool local (compatibilidad con pantallas existentes) **/
  const [questionPool, setQuestionPool] = useState([]); // [{...pregunta, _idHash}]

  /** ================== PREFS LOCALES ================== **/
  useEffect(() => {
    (async () => {
      const [hc, rm, pl] = await Promise.all([
        AsyncStorage.getItem(K_HC),
        AsyncStorage.getItem(K_RM),
        AsyncStorage.getItem(K_PL),
      ]);
      if (hc !== null) _setHighContrast(hc === '1');
      if (rm !== null) _setReduceMotion(rm === '1');
      if (pl !== null) _setPreloadNext(pl === '1');
    })();
  }, []);

  /** ================== AUTH ================== **/
  const signUp = useCallback(async (fullName, documentId, course, email, password) => {
    try {
      const auth = await registerUser(email, password);
      const preferences = { highContrast: false, reduceMotion: false, preloadNext: false };
      const progress = {
        xp: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastSessionDate: null,
        totalCorrect: 0,
        totalWrong: 0,
        chests: 0,
        lives: DEFAULT_LIVES,
        livesMax: DEFAULT_LIVES,
        lifeRecoveryMinutes: DEFAULT_RECOVERY_MIN,
        lastLifeTs: Date.now(),
        maxAttemptsPerQuestion: DEFAULT_ATTEMPTS,
      };
      await set(ref(db, `users/${auth.uid}`), {
        id: auth.uid, fullName, documentId, course, email,
        isAdmin: false,
        preferences, progress,
        questionPool: [], // compat
      });
      setUser({ ...auth, fullName, documentId, course, email, isAdmin: false, preferences, progress });
      setQuestionPool([]);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Error', text2: e.message });
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      const auth = await loginUser(email, password);
      const snap = await get(ref(db, `users/${auth.uid}`));
      const info = snap.val();
      if (info) {
        const p = info.progress || {};
        const progress = {
          ...p,
          lives: p.lives ?? DEFAULT_LIVES,
          livesMax: p.livesMax ?? DEFAULT_LIVES,
          lifeRecoveryMinutes: p.lifeRecoveryMinutes ?? DEFAULT_RECOVERY_MIN,
          lastLifeTs: p.lastLifeTs ?? Date.now(),
          maxAttemptsPerQuestion: p.maxAttemptsPerQuestion ?? DEFAULT_ATTEMPTS,
        };
        const pr = info.preferences || {};
        setUser({ ...auth, ...info, isAdmin: !!info.isAdmin, progress });
        _setHighContrast(!!pr.highContrast);
        _setReduceMotion(!!pr.reduceMotion);
        _setPreloadNext(!!pr.preloadNext);
        await AsyncStorage.multiSet([
          [K_HC, pr.highContrast ? '1' : '0'],
          [K_RM, pr.reduceMotion ? '1' : '0'],
          [K_PL, pr.preloadNext ? '1' : '0'],
        ]);
        // restaura pool local si existiera
        setQuestionPool(Array.isArray(info.questionPool) ? info.questionPool : []);
        await recomputeLives({ ...auth, ...info, progress });
      } else {
        setUser(auth);
        setQuestionPool([]);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Credenciales inválidas' });
    }
  }, []);

  const signOut = useCallback(() => { setUser(null); setQuestionPool([]); }, []);

  /** ================== PREFERENCIAS ================== **/
  const patchPreferencesRemote = useCallback(async (patch) => {
    if (!user?.id) return;
    await update(ref(db, `users/${user.id}/preferences`), patch);
    setUser((u) => ({ ...u, preferences: { ...(u?.preferences || {}), ...patch } }));
  }, [user?.id]);

  const setHighContrast = useCallback(async v => {
    _setHighContrast(v);
    await AsyncStorage.setItem(K_HC, v ? '1' : '0');
    await patchPreferencesRemote({ highContrast: !!v });
  }, [patchPreferencesRemote]);

  const setReduceMotion = useCallback(async v => {
    _setReduceMotion(v);
    await AsyncStorage.setItem(K_RM, v ? '1' : '0');
    await patchPreferencesRemote({ reduceMotion: !!v });
  }, [patchPreferencesRemote]);

  const setPreloadNext = useCallback(async v => {
    _setPreloadNext(v);
    await AsyncStorage.setItem(K_PL, v ? '1' : '0');
    await patchPreferencesRemote({ preloadNext: !!v });
  }, [patchPreferencesRemote]);

  const toggleHighContrast = useCallback(() => setHighContrast(prev => !prev), [setHighContrast]);

  /** ================== POOL LOCAL (compat) ================== **/
  const persistPool = useCallback(async (list) => {
    const trimmed = list.slice(-POOL_CAP);
    if (!user?.id) { setQuestionPool(trimmed); return; }
    await update(ref(db, `users/${user.id}`), { questionPool: trimmed });
    setQuestionPool(trimmed);
  }, [user?.id]);

  const addToPool = useCallback(async (q) => {
    if (!q) return;
    const enriched = normalizeQuestion(q, q.level, q.category);
    const _idHash = makeHash(enriched);
    setQuestionPool(prev => {
      if (prev.some(x => x._idHash === _idHash)) return prev;
      const next = [...prev, { ...enriched, _idHash }];
      persistPool(next).catch(() => { });
      return next;
    });
  }, [persistPool]);

  /** ================== BD: helpers ================== **/
  const upsertQuestionsToDB = async (category, level, list) => {
    if (!list?.length) return;
    const patch = {};
    for (const q of list) {
      const norm = normalizeQuestion(q, level, category);
      const h = makeHash(norm);
      patch[h] = norm;
    }
    await update(ref(db, `questions/${category}/${level}`), patch);
  };

  const fetchRandomFromDB = async ({ category, level, count = 1 }) => {
    const cat = String(category || '').toLowerCase();
    const lev = String(level || '').toLowerCase();
    const snap = await get(ref(db, `questions/${cat}/${lev}`));
    const data = snap.val() || {};
    const bucket = Object.keys(data).map((h) => {
      const norm = normalizeQuestion(data[h], lev, cat);
      return { ...norm, _idHash: h };
    });
    // shuffle
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    return bucket.slice(0, count);
  };

  /** ================== API PÚBLICA SOBRE PREGUNTAS ================== **/

  // Mantengo esta función: intenta traer 1 de pool local; si no hay, va a BD.
  // Solo si no hay stock en BD y el usuario es admin, genera un lote pequeño y guarda.
  const generateAndStore = useCallback(async ({ level, category, fallbackBatchSize = 10 }) => {
    // 1) consumir del pool local compatible
    let picked = null;
    setQuestionPool(prev => {
      const idx = prev.findIndex(q => q.level === level && q.category === category);
      if (idx >= 0) {
        picked = prev[idx];
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        persistPool(rest).catch(() => { });
        return rest;
      }
      return prev;
    });
    if (picked) return picked;

    // 2) leer 1 desde BD global
    const fromDB = await fetchRandomFromDB({ level, category, count: 1 });
    if (fromDB?.length) return fromDB[0];

    // 3) si no hay stock en BD: como ÚLTIMO recurso, solo admin genera lote
    if (user?.isAdmin) {
      const generated = await generarLote(level, category, Math.max(5, fallbackBatchSize));
      if (generated?.length) {
        await upsertQuestionsToDB(category, level, generated);
        Toast.show({ type: 'success', text1: `Se crearon ${generated.length} nuevas preguntas` });
        const again = await fetchRandomFromDB({ level, category, count: 1 });
        return again[0] || null;
      }
    }

    Toast.show({ type: 'info', text1: 'No hay preguntas disponibles en BD' });
    return null;
  }, [persistPool, user?.isAdmin]);

  // Compat: obtiene 1 para las vistas que la piden. NO genera individuales.
  const getNextQuestion = useCallback(async ({ level, category }) => {
    // primero pool local
    let picked = null;
    setQuestionPool(prev => {
      const idx = prev.findIndex(q => q.level === level && q.category === category);
      if (idx >= 0) {
        picked = prev[idx];
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        persistPool(rest).catch(() => { });
        if (preloadNext && rest.length < POOL_MIN) {
          // precarga pasiva: lee 1 de BD y lo mete al pool
          fetchRandomFromDB({ level, category, count: 1 }).then(list => list[0] && addToPool(list[0])).catch(() => { });
        }
        return rest;
      }
      return prev;
    });
    if (picked) return picked;

    // si no, pide 1 a BD
    const fromDB = await fetchRandomFromDB({ level, category, count: 1 });
    if (fromDB?.length) return fromDB[0];

    // último recurso coherente con tu regla: no generamos individuales; delega en generateAndStore (que genera lote solo admin)
    return await generateAndStore({ level, category });
  }, [persistPool, preloadNext, addToPool, generateAndStore]);

  // Obtiene un lote aleatorio desde BD (permite mezclar niveles/categorías)
  const getBatchQuestions = useCallback(
    async ({ level, count = 5, categories = ['fracciones', 'algebra', 'igualdades'] }) => {
      const lev = String(level || '').toLowerCase();
      let bucket = [];

      for (const rawCat of categories) {
        const cat = String(rawCat || '').toLowerCase();
        const snap = await get(ref(db, `questions/${cat}/${lev}`));
        const data = snap.val() || {};
        for (const h of Object.keys(data)) {
          const norm = normalizeQuestion(data[h], lev, cat);
          if (norm.category === cat && norm.level === lev) {
            bucket.push({ ...norm, _idHash: h });
          }
        }
      }

      // Separar por tipo y barajar
      const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
      const mult = shuffle(bucket.filter(q => q.type === 'multiple'));
      const match = shuffle(bucket.filter(q => q.type === 'matching'));

      const wantMult = Math.floor(count / 2);
      const wantMatch = count - wantMult;

      const pickMult = mult.slice(0, wantMult);
      const pickMatch = match.slice(0, wantMatch);

      let out = [...pickMult, ...pickMatch];

      // Si falta alguno, rellenar con el otro tipo
      if (out.length < count) {
        const deficit = count - out.length;
        const leftovers = [...mult.slice(pickMult.length), ...match.slice(pickMatch.length)];
        out = [...out, ...leftovers.slice(0, deficit)];
      }

      // Barajar resultado final
      return shuffle(out).slice(0, count);
    },
    []
  );

  // Admin: crear lote y guardar (dedup contra BD)
  const createQuestionsBatch = useCallback(async ({ category, level, count }) => {
    if (!user?.isAdmin) {
      Toast.show({ type: 'error', text1: 'No autorizado' });
      return [];
    }
    const cat = String(category || '').toLowerCase();
    const lev = String(level || '').toLowerCase();

    const existingSnap = await get(ref(db, `questions/${cat}/${lev}`));
    const existingMap = existingSnap.val() || {};
    const existingHashes = new Set(Object.keys(existingMap));

    // Pedimos algo de holgura para poder balancear 50/50
    const overshoot = Math.max(4, Math.ceil(count * 0.4));
    const generated = await generarLote(lev, cat, count + overshoot);

    // Dejar 50/50 en el batch final
    const wantMultiple = Math.floor(count / 2);
    const wantMatching = count - wantMultiple;

    const multiples = [];
    const matchings = [];
    const seen = new Set();

    const pushIfNew = (q) => {
      const norm = normalizeQuestion(q, lev, cat);
      const h = makeHash(norm);
      if (existingHashes.has(h) || seen.has(h)) return false;
      seen.add(h);
      if (norm.type === 'multiple') multiples.push(norm);
      else if (norm.type === 'matching') matchings.push(norm);
      return true;
    };

    for (const q of generated) pushIfNew(q);

    const pickMultiples = multiples.slice(0, wantMultiple);
    const pickMatchings = matchings.slice(0, wantMatching);

    let batch = [...pickMultiples, ...pickMatchings];

    // Si falta de algún tipo, rellenar con el otro manteniendo dedupe
    if (batch.length < count) {
      const deficit = count - batch.length;
      const leftovers = [
        ...multiples.slice(pickMultiples.length),
        ...matchings.slice(pickMatchings.length),
      ];
      for (const q of leftovers) {
        if (batch.length >= count) break;
        // ya está normalizado; makeHash coherente
        const h = makeHash(q);
        if (!existingHashes.has(h) && !batch.some(b => makeHash(b) === h)) {
          batch.push(q);
        }
      }
    }

    if (!batch.length) {
      Toast.show({ type: 'info', text1: 'No se generaron nuevas preguntas (posibles duplicados)' });
      return [];
    }

    await upsertQuestionsToDB(cat, lev, batch);
    Toast.show({ type: 'success', text1: `Guardadas ${batch.length} preguntas` });
    return batch.map(q => ({ ...q, _idHash: makeHash(q) }));
  }, [user?.isAdmin]);

  /** ================== VIDAS / XP ================== **/
  const recomputeLives = useCallback(async (srcUser = user) => {
    const u = srcUser || user;
    if (!u?.id) return;
    const p = u.progress || {};
    let { lives = DEFAULT_LIVES, livesMax = DEFAULT_LIVES, lifeRecoveryMinutes = DEFAULT_RECOVERY_MIN, lastLifeTs = Date.now() } = p;
    if (lives >= livesMax) return;
    const perMs = (lifeRecoveryMinutes || DEFAULT_RECOVERY_MIN) * 60 * 1000;
    const now = Date.now();
    const elapsed = now - (lastLifeTs || now);
    const recovered = Math.floor(elapsed / perMs);
    if (recovered > 0) {
      const newLives = Math.min(livesMax, lives + recovered);
      const remainder = elapsed % perMs;
      const newLastTs = now - remainder;
      await update(ref(db, `users/${u.id}/progress`), { lives: newLives, lastLifeTs: newLastTs });
      setUser((old) => ({ ...old, progress: { ...(old?.progress || {}), lives: newLives, lastLifeTs: newLastTs } }));
    }
  }, [user]);

  useEffect(() => {
    const id = setInterval(recomputeLives, 60_000);
    return () => clearInterval(id);
  }, [recomputeLives]);

  const spendLife = useCallback(async () => {
    if (!user?.id) return false;
    const p = user.progress || {};
    if ((p.lives ?? 0) <= 0) return false;
    const lives = (p.lives ?? 0) - 1;
    const ts = Date.now();
    await update(ref(db, `users/${user.id}/progress`), { lives, lastLifeTs: ts });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), lives, lastLifeTs: ts } }));
    return true;
  }, [user]);

  const giveLife = useCallback(async (n = 1) => {
    if (!user?.id) return;
    const p = user.progress || {};
    const lives = Math.min((p.lives ?? 0) + n, p.livesMax ?? DEFAULT_LIVES);
    await update(ref(db, `users/${user.id}/progress`), { lives });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), lives } }));
  }, [user]);

  const timeToNextLifeMs = useCallback(() => {
    const p = user?.progress || {};
    if ((p.lives ?? 0) >= (p.livesMax ?? DEFAULT_LIVES)) return 0;
    const perMs = (p.lifeRecoveryMinutes ?? DEFAULT_RECOVERY_MIN) * 60 * 1000;
    const elapsed = Date.now() - (p.lastLifeTs ?? Date.now());
    const left = perMs - (elapsed % perMs);
    return Math.max(left, 0);
  }, [user]);

  const payXP = useCallback(async (cost) => {
    if (!user?.id) return false;
    const xp = user?.progress?.xp ?? 0;
    if (xp < cost) {
      Toast.show({ type: 'error', text1: 'XP insuficiente', text2: `Necesitas ${cost} XP` });
      return false;
    }
    const newXP = xp - cost;
    await update(ref(db, `users/${user.id}/progress`), { xp: newXP });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), xp: newXP } }));
    return true;
  }, [user]);

  const buyLifeWithXP = useCallback(async (cost = 50) => {
    if (!user?.id) return;
    const p = user.progress || {};
    if (p.lives >= p.livesMax) {
      Toast.show({ type: 'info', text1: 'Ya estás al máximo' });
      return;
    }
    const ok = await payXP(cost);
    if (!ok) return;
    await giveLife(1);
    Toast.show({ type: 'success', text1: '¡Vida recargada!' });
  }, [user, payXP, giveLife]);

  const upgradeLivesMax = useCallback(async () => {
    if (!user?.id) return;
    const current = user?.progress?.livesMax ?? DEFAULT_LIVES;
    if (current >= MAX_LIVES_CAP) {
      Toast.show({ type: 'info', text1: 'Máximo alcanzado', text2: `Ya tienes ${MAX_LIVES_CAP} vidas máximas` });
      return;
    }
    const cost = 150 + (current - DEFAULT_LIVES) * 50;
    const ok = await payXP(cost);
    if (!ok) return;
    const livesMax = Math.min(MAX_LIVES_CAP, current + 1);
    await update(ref(db, `users/${user.id}/progress`), { livesMax });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), livesMax } }));
    Toast.show({ type: 'success', text1: 'Mejora aplicada', text2: `Vidas máximas: ${livesMax}` });
  }, [user, payXP]);

  const reduceRecoveryTime = useCallback(async () => {
    if (!user?.id) return;
    const current = user?.progress?.lifeRecoveryMinutes ?? DEFAULT_RECOVERY_MIN;
    if (current <= MIN_RECOVERY_MIN) {
      Toast.show({ type: 'info', text1: 'Mínimo alcanzado', text2: `${MIN_RECOVERY_MIN} min por vida` });
      return;
    }
    const step = current > 60 ? 30 : 15;
    const cost = current > 60 ? 200 : 300;
    const ok = await payXP(cost);
    if (!ok) return;
    const lifeRecoveryMinutes = Math.max(MIN_RECOVERY_MIN, current - step);
    await update(ref(db, `users/${user.id}/progress`), { lifeRecoveryMinutes });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), lifeRecoveryMinutes } }));
    Toast.show({ type: 'success', text1: 'Mejora aplicada', text2: `Nueva recuperación: ${lifeRecoveryMinutes} min` });
  }, [user, payXP]);

  const upgradeAttempts = useCallback(async () => {
    if (!user?.id) return;
    const current = user?.progress?.maxAttemptsPerQuestion ?? DEFAULT_ATTEMPTS;
    if (current >= MAX_ATTEMPTS_CAP) {
      Toast.show({ type: 'info', text1: 'Máximo alcanzado', text2: `Intentos: ${current}` });
      return;
    }
    const cost = 250;
    const ok = await payXP(cost);
    if (!ok) return;
    const maxAttemptsPerQuestion = Math.min(MAX_ATTEMPTS_CAP, current + 1);
    await update(ref(db, `users/${user.id}/progress`), { maxAttemptsPerQuestion });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), maxAttemptsPerQuestion } }));
    Toast.show({ type: 'success', text1: 'Mejora aplicada', text2: `Intentos por pregunta: ${maxAttemptsPerQuestion}` });
  }, [user, payXP]);

  /** ================== PROGRESO ================== **/
  const ensureDailyStreak = useCallback(async () => {
    if (!user?.id) return;
    const today = todayYMD();
    const last = user?.progress?.lastSessionDate;
    if (last === today) return;
    let nextStreak = 1;
    if (last) {
      const diff = (new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000;
      nextStreak = diff === 1 ? (user.progress.currentStreak || 0) + 1 : 1;
    }
    const best = Math.max(user?.progress?.bestStreak || 0, nextStreak);
    const patch = { lastSessionDate: today, currentStreak: nextStreak, bestStreak: best };
    await update(ref(db, `users/${user.id}/progress`), patch);
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), ...patch } }));
  }, [user]);

  const addXP = useCallback(async (delta) => {
    if (!user?.id) return;
    const newXP = (user?.progress?.xp || 0) + Number(delta || 0);
    const chests = Math.floor(newXP / 100);
    await update(ref(db, `users/${user?.id}/progress`), { xp: newXP, chests });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), xp: newXP, chests } }));
  }, [user]);

  const registerCorrect = useCallback(async () => {
    if (!user?.id) return;
    const totalCorrect = (user?.progress?.totalCorrect || 0) + 1;
    await update(ref(db, `users/${user.id}/progress`), { totalCorrect });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), totalCorrect } }));
  }, [user]);

  const registerWrong = useCallback(async () => {
    if (!user?.id) return;
    const totalWrong = (user?.progress?.totalWrong || 0) + 1;
    await update(ref(db, `users/${user.id}/progress`), { totalWrong });
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), totalWrong } }));
  }, [user]);

  const completeDailyGoalIfNeeded = useCallback(async () => {
    if (!user?.id) return;
    const today = todayYMD();
    if (user?.progress?.dailyChallengeCompletedDate === today) return;
    let nextStreak = 1;
    const last = user?.progress?.lastSessionDate;
    if (last) {
      const diff = (new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000;
      nextStreak = diff === 1 ? (user.progress.currentStreak || 0) + 1 : 1;
    }
    const best = Math.max(user?.progress?.bestStreak || 0, nextStreak);
    const patch = { lastSessionDate: today, dailyChallengeCompletedDate: today, currentStreak: nextStreak, bestStreak: best };
    await update(ref(db, `users/${user.id}/progress`), patch);
    setUser((u) => ({ ...u, progress: { ...(u?.progress || {}), ...patch } }));
  }, [user]);

  const isDailyChallengeDoneToday = useCallback(() => {
    const today = todayYMD();
    return user?.progress?.dailyChallengeCompletedDate === today;
  }, [user]);

  const openProfileModal = useCallback(() => setProfileModalVisible(true), []);
  const closeProfileModal = useCallback(() => setProfileModalVisible(false), []);

  /** ================== VALUE ================== **/
  const value = useMemo(() => ({
    user,
    signIn, signUp, signOut,

    // ADMIN / PREGUNTAS
    createQuestionsBatch,   // genera LOTE por IA y guarda
    getBatchQuestions,      // trae lote aleatorio desde BD

    // Compat: mantenemos estos métodos y estado
    questionPool,
    addToPool,
    getNextQuestion,        // ahora consume 1 de pool o 1 de BD (sin generar individuales)
    generateAndStore,       // wrapper: si no hay stock en BD, solo admin genera un lote pequeño

    // preferencias
    highContrast, reduceMotion, preloadNext,
    setHighContrast, setReduceMotion, setPreloadNext, toggleHighContrast,

    // vidas / cronómetro / compras
    spendLife, giveLife, recomputeLives, timeToNextLifeMs,
    buyLifeWithXP, upgradeLivesMax, reduceRecoveryTime, upgradeAttempts,

    // progreso
    ensureDailyStreak, addXP, registerCorrect, registerWrong,
    completeDailyGoalIfNeeded, isDailyChallengeDoneToday,

    // UI perfil
    openProfileModal, closeProfileModal, profileModalVisible,
  }), [
    user,
    signIn, signUp, signOut,
    createQuestionsBatch, getBatchQuestions,

    questionPool, addToPool, getNextQuestion, generateAndStore,

    highContrast, reduceMotion, preloadNext,
    setHighContrast, setReduceMotion, setPreloadNext, toggleHighContrast,

    spendLife, giveLife, recomputeLives, timeToNextLifeMs,
    buyLifeWithXP, upgradeLivesMax, reduceRecoveryTime, upgradeAttempts,

    ensureDailyStreak, addXP, registerCorrect, registerWrong,
    completeDailyGoalIfNeeded, isDailyChallengeDoneToday,

    openProfileModal, closeProfileModal, profileModalVisible,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <Toast />
    </AppContext.Provider>
  );
}