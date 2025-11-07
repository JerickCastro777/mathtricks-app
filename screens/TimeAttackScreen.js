import React, { useContext, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../contexts/AppContext';
import { normalizeQuestion } from '../utils/questions';

// categorías y niveles que vamos a mezclar
const CATS = ['fracciones', 'algebra', 'igualdades'];
const LEVELS = ['facil', 'medio', 'dificil'];

const formatHMS = (ms) => {
  if (!ms || ms <= 0) return '00:00';
  const t = Math.ceil(ms / 1000);
  const m = Math.floor(t / 60), s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
};

// devuelve muestra aleatoria sin reemplazo
const sample = (arr, n) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

export default function TimeAttackScreen({ route, navigation }) {
  const { totalMs = 120000 } = route.params ?? {};
  const {
    highContrast, reduceMotion,
    getBatchQuestions, addXP,
  } = useContext(AppContext);

  // --------- CONFIG DE ESTA MODALIDAD ---------
  const TARGET = 5;           // preguntas por ronda inicial
  const REWARD_XP = 200;      // premio final si completas todo
  const START_LIVES = 3;      // vidas locales para esta modalidad

  // --------- FASES ---------
  // preload -> playing -> reviewWrong -> done
  const [phase, setPhase] = useState('preload');

  // temporizador
  const [remaining, setRemaining] = useState(totalMs);
  const timerRef = useRef(null);
  const startTsRef = useRef(null);

  // vidas locales
  const [lives, setLives] = useState(START_LIVES);

  // paquetes
  const [pack, setPack] = useState([]);       // lote de juego actual
  const [index, setIndex] = useState(0);      // índice actual dentro del pack
  const q = pack[index] || null;

  // para la segunda vuelta (solo las malas)
  const wrongQueueRef = useRef([]);           // acumulador de falladas en la 1ª pasada
  const [isReviewRound, setIsReviewRound] = useState(false);

  // UI / estado de respuesta
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [resultModal, setResultModal] = useState({ show: false, win: false });
  const [selected, setSelected] = useState(null); // opción elegida
  const [showContinue, setShowContinue] = useState(false); // mostrar botón “Continuar” tras fallar
  const [answeredCorrect, setAnsweredCorrect] = useState(0); // aciertos de la ronda actual

  // ---------- HEADER ----------
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Contrarreloj',
      headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#fff' },
      headerTintColor: '#fff',
      headerBackground: () => highContrast
        ? <View style={{ flex: 1, backgroundColor: '#0B0B0B' }} />
        : <LinearGradient colors={['#111827', '#1f2937']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />,
      headerShadowVisible: false,
    });
  }, [navigation, highContrast]);

  // ---------- CARGA DE PREGUNTAS (mezcla aleatoria de BD) ----------
  const preloadMixed = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // pedimos un puñado de cada combinación (pequeño para no sobrecargar)
      const all = [];
      const seen = new Set();
      for (const lvl of LEVELS) {
        // pedimos por grupos de categorías para ese nivel
        const fromLevel = await getBatchQuestions({ level: lvl, count: 8, categories: CATS });
        for (const raw of (fromLevel || [])) {
          const q = normalizeQuestion(raw, raw.level, raw.category);
          if (q?.type !== 'multiple') continue;
          const key = q._idHash || JSON.stringify([q.level, q.category, q.question, q.answer, (q.options || []).join('|')]);
          if (seen.has(key)) continue;
          seen.add(key);
          all.push(q);
        }
      }
      if (all.length < 3) {
        setLoadError('No hay suficientes preguntas en la base de datos.');
        setLoading(false);
        return;
      }
      const round = sample(all, TARGET);
      setPack(round);
      setIndex(0);
      wrongQueueRef.current = [];
      setIsReviewRound(false);
      setAnsweredCorrect(0);
      setSelected(null);
      setShowContinue(false);
      setLives(START_LIVES);
      setPhase('playing');
    } catch (e) {
      console.error('preloadMixed error:', e);
      setLoadError('Error al preparar ejercicios.');
    } finally {
      setLoading(false);
    }
  }, [getBatchQuestions]);

  // montaje: precargar y arrancar el reloj
  useEffect(() => {
    preloadMixed();
  }, [preloadMixed]);

  // reloj
  useEffect(() => {
    if (phase !== 'playing') return;
    startTsRef.current = Date.now();
    setRemaining(totalMs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTsRef.current;
      const left = totalMs - elapsed;
      setRemaining(left > 0 ? left : 0);
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, totalMs]);

  // terminar por tiempo
  useEffect(() => {
    if (phase === 'playing' && remaining <= 0) {
      endLose();
    }
  }, [remaining, phase]);

  // ---------- helpers fin ----------
  const endLose = () => {
    setPhase('done');
    if (timerRef.current) clearInterval(timerRef.current);
    setResultModal({ show: true, win: false });
  };
  const endWin = async () => {
    setPhase('done');
    if (timerRef.current) clearInterval(timerRef.current);
    // premio
    try { await addXP(REWARD_XP); } catch { /* noop */ }
    setResultModal({ show: true, win: true });
  };

  // ---------- navegación de preguntas ----------
  const nextQuestion = () => {
    setSelected(null);
    setShowContinue(false);
    const nextIdx = index + 1;
    if (nextIdx < pack.length) {
      setIndex(nextIdx);
      return;
    }
    // fin de la ronda actual
    if (!isReviewRound) {
      // si hubo fallos y quedan tiempo y vidas -> pasamos a ronda de repaso
      if (wrongQueueRef.current.length > 0 && remaining > 0 && lives > 0) {
        setPack(wrongQueueRef.current);
        setIndex(0);
        wrongQueueRef.current = [];
        setIsReviewRound(true);
        setAnsweredCorrect(0);
      } else {
        // todas bien en la primera pasada o no hay tiempo/vidas => victoria si todas bien
        if (wrongQueueRef.current.length === 0) endWin();
        else endLose();
      }
    } else {
      // terminamos ronda de repaso: si ya no hubo fallos, victoria
      if (wrongQueueRef.current.length === 0) endWin();
      else endLose();
    }
  };

  // ---------- interacción ----------
  const onPick = (opt) => {
    if (phase !== 'playing' || !q || q.type !== 'multiple' || showContinue) return;
    setSelected(opt);
    const ok = opt === q.answer;
    if (ok) {
      setAnsweredCorrect(v => v + 1);
      nextQuestion();
    } else {
      // fallo: consumimos vida y guardamos para repaso
      if (lives - 1 <= 0) {
        setLives(0);
        endLose();
        return;
      }
      setLives(l => l - 1);
      wrongQueueRef.current.push(q);
      // marcar rojo y mostrar “Continuar”
      setShowContinue(true);
    }
  };

  const onContinueAfterWrong = () => {
    // tras mostrar en rojo, pasamos a la siguiente
    nextQuestion();
  };

  // ---------- UI ----------
  const Container = highContrast ? View : LinearGradient;
  const containerProps = highContrast
    ? { style: styles.container }
    : { colors: ['#e2e8f0', '#cbd5e1'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, style: styles.container };

  const renderPreload = () => (
    <View style={sx.centerBox}>
      <Text style={[sx.titlePre, highContrast && { color: '#0B0B0B' }]}>Preparando ejercicios…</Text>
      {loading ? <ActivityIndicator size="large" /> : null}
      {loadError ? (
        <>
          <Text style={[sx.err, highContrast && { color: '#7f1d1d' }]}>{loadError}</Text>
          <Pressable onPress={preloadMixed} style={sx.retryBtn}>
            <Text style={sx.retryText}>Reintentar</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );

  const renderGame = () => {
    if (!q) return null;
    return (
      <>
        {/* HUD */}
        <View style={sx.hud}>
          <View style={[sx.badge, highContrast && sx.hcBadge]}>
            <Text style={[sx.badgeText, highContrast && sx.hcBadgeText]}>⏱ {formatHMS(remaining)}</Text>
          </View>
          <View style={[sx.badge, highContrast && sx.hcBadge]}>
            <Text style={[sx.badgeText, highContrast && sx.hcBadgeText]}>
              {isReviewRound ? '🔁 Repaso' : '📚 Ronda'} · ✅ {answeredCorrect}/{pack.length} · ❤️ {lives}
            </Text>
          </View>
        </View>

        {/* Pregunta */}
        <View style={[sx.card, highContrast && sx.hcCard]}>
          <Text style={[sx.qText, highContrast && { color: '#0B0B0B' }]}>{q.question}</Text>
        </View>

        {/* Opciones */}
        <View style={{ marginTop: 4 }}>
          {(q.options ?? []).map((opt, i) => {
            const wrong = showContinue && selected === opt && opt !== q.answer;
            const correct = showContinue && opt === q.answer;
            return (
              <Pressable key={i}
                disabled={showContinue}
                onPress={() => onPick(opt)}
                style={({ pressed }) => [
                  sx.opt,
                  highContrast && sx.hcOpt,
                  wrong && sx.optWrong,
                  correct && sx.optCorrect,
                  pressed && !showContinue && { opacity: 0.92, transform: [{ scale: 0.98 }] }
                ]}
              >
                <Text style={[
                  sx.optText,
                  highContrast && sx.hcOptText,
                  (wrong || correct) && { color: '#fff' }
                ]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Continuar cuando falló */}
        {showContinue && (
          <>
            <Text style={[sx.helpText, highContrast && { color: '#0B0B0B' }]}>
              Respuesta correcta: <Text style={{ fontWeight: '900' }}>{String(q.answer)}</Text>
            </Text>
            <Pressable onPress={onContinueAfterWrong} style={sx.continueBtn}>
              <Text style={sx.continueText}>Continuar</Text>
            </Pressable>
          </>
        )}
      </>
    );
  };

  return (
    <Container {...containerProps}>
      <SafeAreaView style={{ flex: 1 }}>
        {phase === 'preload' && renderPreload()}
        {phase !== 'preload' && renderGame()}

        {/* Modal fin */}
        <Modal transparent visible={resultModal.show} animationType={reduceMotion ? 'none' : 'fade'}>
          <View style={sx.modalBackdrop}>
            <View style={[sx.modalCard, highContrast && sx.hcCard]}>
              {resultModal.win ? (
                <>
                  <Text style={sx.modalTitle}>¡Lo lograste! 🎉</Text>
                  <Text style={sx.modalBody}>Completaste todas las preguntas. +{REWARD_XP} XP</Text>
                  <Pressable onPress={() => { setResultModal({ show: false, win: false }); navigation.popToTop(); }} style={sx.modalBtn}>
                    <Text style={sx.modalBtnText}>Continuar</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={sx.modalTitle}>¡Fin del juego!</Text>
                  <Text style={sx.modalBody}>Te quedaste sin tiempo o sin vidas.</Text>
                  <Pressable onPress={() => { setResultModal({ show: false, win: false }); navigation.popToTop(); }} style={sx.modalBtn}>
                    <Text style={sx.modalBtnText}>Volver</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});

const sx = StyleSheet.create({
  hud: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  badge: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  badgeText: { fontWeight: '900', color: '#111827' },
  hcBadge: { backgroundColor: '#F2F2F2', borderColor: '#111' },
  hcBadgeText: { color: '#0B0B0B' },

  card: { backgroundColor: '#fff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 8 },
  hcCard: { backgroundColor: '#FFFFFF', borderColor: '#111' },
  qText: { fontSize: 16, lineHeight: 24, color: '#0F172A' },

  opt: { backgroundColor: '#1E3A8A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginVertical: 6 },
  optText: { color: '#fff', fontWeight: '800' },
  hcOpt: { backgroundColor: '#0B0B0B' },
  hcOptText: { color: '#FFFFFF' },
  optWrong: { backgroundColor: '#dc2626' },
  optCorrect: { backgroundColor: '#059669' },

  continueBtn: { backgroundColor: '#1E3A8A', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginTop: 10, alignSelf: 'center' },
  continueText: { color: '#fff', fontWeight: '900' },
  helpText: { textAlign: 'center', marginTop: 8, color: '#334155' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', width: '100%', maxWidth: 480, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6, color: '#111827' },
  modalBody: { fontSize: 15, color: '#1f2937', textAlign: 'center', marginBottom: 12 },
  modalBtn: { backgroundColor: '#1E3A8A', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  modalBtnText: { color: '#fff', fontWeight: '900' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  titlePre: { fontSize: 18, fontWeight: '800', color: '#111827' },
  err: { fontSize: 14, color: '#991b1b', textAlign: 'center', maxWidth: 320 },
  retryBtn: { backgroundColor: '#1E3A8A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginTop: 6 },
  retryText: { color: '#fff', fontWeight: '800' },
});
