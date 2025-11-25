// screens/ExerciseScreen.jsx
import React, { useEffect, useState, useCallback, useLayoutEffect, useContext, useRef } from "react";
import { View, Text, Pressable, Alert, StyleSheet, ActivityIndicator, Animated, Easing, ScrollView, Modal, SafeAreaView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../contexts/AppContext";
import { normalizeQuestion, isMatchingWellFormed } from "../utils/questions";

const XP_PER_CORRECT = 10;
const XP_STREAK_BONUS = 5;
const LEVEL_TARGET = 5;
const LOAD_COUNT = 10;
const DEFAULT_TAB_STYLE = { backgroundColor: "#1E3A8A", borderTopLeftRadius: 16, borderTopRightRadius: 16, height: 70, position: "absolute", shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: -2 }, shadowRadius: 8, elevation: 6 };

const CATEGORY_LABELS = { fracciones: "Fracciones", algebra: "Álgebra", igualdades: "Igualdades" };
const LEVEL_LABELS = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };

const formatHMS = (ms) => {
  if (!ms || ms <= 0) return "00:00:00";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2,"0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

export default function ExerciseScreen({ route, navigation }) {
  const { nivel='facil', colors: levelColors, category='fracciones' } = route.params ?? {};
  const {
    highContrast, reduceMotion, preloadNext,
    addXP, registerCorrect, registerWrong, user, completeDailyGoalIfNeeded,
    spendLife, timeToNextLifeMs, recomputeLives,
    getBatchQuestions,
  } = useContext(AppContext);

  const lives = user?.progress?.lives ?? 0;
  const livesMax = user?.progress?.livesMax ?? 5;
  const maxAttempts = user?.progress?.maxAttemptsPerQuestion ?? 2;

  const colors = highContrast ? ["#FFFFFF", "#FFFFFF"] :
    (Array.isArray(levelColors) && levelColors.length >= 2 ? levelColors : ["#eaf2ff", "#cfe1ff"]);

  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const question = questions[qIndex] || null;

  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(maxAttempts);
  const [correctCount, setCorrectCount] = useState(0);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triedWrong, setTriedWrong] = useState([]);

  const [pendingSpendLife, setPendingSpendLife] = useState(false);

  const [mLeftSel, setMLeftSel] = useState(null);
  const [mPairs, setMPairs] = useState([]);

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const runShake = () => { if (reduceMotion) return;
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  };
  const runPulse = () => { if (reduceMotion) return;
    pulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 140, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  useFocusEffect(useCallback(() => {
    const parent = navigation.getParent?.();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => parent?.setOptions({ tabBarStyle: DEFAULT_TAB_STYLE });
  }, [navigation]));

  useLayoutEffect(() => {
    const catLabel = CATEGORY_LABELS[category] ?? String(category).toUpperCase();
    const levelLabel = nivel === "facil" ? "FÁCIL" : (LEVEL_LABELS[nivel]?.toUpperCase?.() ?? String(nivel).toUpperCase());
    navigation.setOptions({
      headerTitle: `${catLabel.toUpperCase()} · ${levelLabel}`,
      headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#fff', letterSpacing: 0.6 },
      headerTintColor: '#fff',
      headerBackground: () => highContrast
        ? <View style={{ flex: 1, backgroundColor: "#0B0B0B" }} />
        : <LinearGradient colors={colors} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />,
      headerShadowVisible: false,
    });
  }, [navigation, nivel, colors, highContrast, category]);

  const resetQuestionState = useCallback(() => {
    setSelected(null); setLocked(false); setResult(null);
    setAttemptsLeft(user?.progress?.maxAttemptsPerQuestion ?? 2);
    setResultVisible(false); setTriedWrong([]);
    setMLeftSel(null); setMPairs([]);
    setPendingSpendLife(false);
  }, [user?.progress?.maxAttemptsPerQuestion]);

  const loadQuestionsFromDB = useCallback(async () => {
    setLoading(true);
    resetQuestionState();
    try {
      const list = await getBatchQuestions({ level: nivel, count: LOAD_COUNT, categories: [category] });
      const normalized = (Array.isArray(list) ? list : []).map(q => normalizeQuestion(q, nivel, category));
      setQuestions(normalized);
      setQIndex(0);
    } catch (e) {
      Alert.alert("Error", "No se pudieron cargar las preguntas.");
      setQuestions([]); setQIndex(0);
    } finally { setLoading(false); }
  }, [getBatchQuestions, nivel, category, resetQuestionState]);

  useEffect(() => { loadQuestionsFromDB(); }, [loadQuestionsFromDB]);

useEffect(() => {
  if (lives <= 0 && !loading) {
    const mins = Math.ceil(timeToNextLifeMs() / 60000);

    navigation.reset({
      index: 0,
      routes: [{ name: "Inicio" }],
    });

    setTimeout(() => {
      Alert.alert("Sin vidas", `Se recuperará una vida en aprox. ${mins} min.`);
    }, 250);
  }
}, [lives, loading, navigation, timeToNextLifeMs]);

  const handleCorrect = () => {
    setResult("correct"); setLocked(true); setResultVisible(true); runPulse();
    setScore((s) => s + XP_PER_CORRECT);
    const streakBonus = user?.progress?.currentStreak > 0 ? XP_STREAK_BONUS : 0;
    addXP(XP_PER_CORRECT + streakBonus); registerCorrect();
    setCorrectCount((prev) => {
      const next = prev + 1;
      if (next >= LEVEL_TARGET) setTimeout(() => { setResultVisible(false); setLevelCompleted(true); }, reduceMotion ? 0 : 150);
      return next;
    });
  };

  const consumeAttemptOrLife = async () => {
    setAttemptsLeft((prev) => prev - 1);
    if (attemptsLeft - 1 <= 0) {
      setPendingSpendLife(true);
      setLocked(true);
      return;
    }
  };

  const handleWrong = async () => {
    setResult("wrong"); setResultVisible(true); runShake();
    registerWrong();
    if (selected !== null && selected !== undefined) {
      setTriedWrong(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        if (!next.includes(selected)) next.push(selected);
        return next;
      });
    }
    await consumeAttemptOrLife();
  };

  const checkAnswerMultiple = (option) => {
    if (!question || locked || resultVisible) return;
    setSelected(option);
    if (option === question.answer) handleCorrect();
    else handleWrong();
  };

  const toggleMatch = (iLeft, iRight) => {
    const exists = mPairs.find(([L, R]) => L === iLeft || R === iRight);
    if (exists) setMPairs((prev) => prev.filter(([L, R]) => L !== iLeft && R !== iRight).concat([[iLeft, iRight]]));
    else setMPairs((prev) => prev.concat([[iLeft, iRight]]));
  };
  const onPressLeft = (i) => setMLeftSel(i === mLeftSel ? null : i);
  const onPressRight = (j) => { if (mLeftSel !== null) { toggleMatch(mLeftSel, j); setMLeftSel(null); } };
  const isRightUsed = (j) => mPairs.some(([,R]) => R === j);
  const getRightOfLeft = (i) => (mPairs.find(([L]) => L === i) || [null,null])[1];

  const checkMatching = () => {
    if (!question || locked || resultVisible) return;
    const expected = [...(question.pairs || [])].sort((a,b)=>a[0]-b[0]);
    const given = [...mPairs].sort((a,b)=>a[0]-b[0]);
    const ok = expected.length === given.length && expected.every(([L,R], k) => L === given[k][0] && R === given[k][1]);
    ok ? handleCorrect() : handleWrong();
  };

  const onContinue = async () => {
    if (levelCompleted) return;
    if (pendingSpendLife) {
      const ok = await spendLife();
      await recomputeLives();
      setPendingSpendLife(false);
      setResultVisible(false);
      resetQuestionState();
      if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
      else loadQuestionsFromDB();
      return;
    }

    setResultVisible(false);
    resetQuestionState();
    if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
    else loadQuestionsFromDB();
  };

  const finishLevel = async () => {
    setLevelCompleted(false);
    await completeDailyGoalIfNeeded();
    Alert.alert("¡Nivel completado!", "Buen trabajo. Volverás al menú del nivel.");
    navigation.goBack();
  };

  const Container = highContrast ? View : LinearGradient;
  const containerProps = highContrast ? { style: styles.container } : { colors, style: styles.container };
  const letters = ["A","B","C","D","E","F"];
  const shake = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  const canRetry = result === "wrong" && attemptsLeft > 0 && !locked;

  const renderCorrectFeedback = () => {
    if (!question) return null;
    if (question.type === 'matching') {
      const left = Array.isArray(question.left) ? question.left : [];
      const right = Array.isArray(question.right) ? question.right : [];
      const pairs = Array.isArray(question.pairs) ? question.pairs : [];
      return (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '800', marginBottom: 6 }}>Emparejamientos correctos:</Text>
          {pairs.map(([L,R], idx) => (
            <Text key={`pairf-${idx}`} style={{ marginBottom: 4 }}>
              {String(left[L])} → {String(right[R])}
            </Text>
          ))}
        </View>
      );
    } else {
      const correct = question.answer;
      return (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '800', marginBottom: 6 }}>Respuesta correcta:</Text>
          <Text style={{ marginBottom: 6 }}>{String(correct)}</Text>
          {question.explanation ? <Text style={{ marginTop: 6 }}>{String(question.explanation)}</Text> : null}
        </View>
      );
    }
  };

  if (loading) {
    return (
      <Container {...containerProps}>
        <ActivityIndicator size="large" />
        <Text style={[styles.footer, { marginTop: 12, color: highContrast ? "#111" : "#334155" }]}>Cargando preguntas…</Text>
      </Container>
    );
  }
  if (!question) {
    const catLabel = CATEGORY_LABELS[category] ?? String(category);
    const levelLabel = LEVEL_LABELS[nivel] ?? String(nivel);
    return (
      <Container {...containerProps}>
        <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color: highContrast ? '#0B0B0B' : '#1E3A8A', textAlign:'center' }}>
            No hay preguntas disponibles para “{catLabel} · {levelLabel}”.
          </Text>
        </SafeAreaView>
      </Container>
    );
  }

  const msLeft = timeToNextLifeMs() + (nowTick && 0);
  const nextLifeStr = msLeft ? formatHMS(msLeft) : "—";

  const renderMultiple = () => (
    <>
      <Animated.View style={[
        sx.questionCard, highContrast && sx.hcCard,
        !reduceMotion && result==="wrong" && { transform: [{ translateX: shake }] },
        !reduceMotion && result==="correct" && { transform: [{ scale: pulseAnim }] },
      ]}>
        <Text style={[styles.question, highContrast && { color: "#0B0B0B" }]}>{String(question.question)}</Text>
      </Animated.View>

      <View style={sx.optionsWrap}>
        {(Array.isArray(question.options) ? question.options : []).map((opt, idx) => {
          const state = (() => {
            if (locked) {
              if (opt === question.answer) return "correct";
              if (opt === selected && result === "wrong") return "wrong";
              return "idle";
            }
            if (triedWrong.includes(opt)) return "disabled";
            return "idle";
          })();
          const disabled = locked || state === "disabled" || resultVisible;
          return (
            <Pressable
              key={`${idx}-${opt}`}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              onPress={() => !disabled && checkAnswerMultiple(opt)}
              style={({ pressed }) => [
                styles.option,
                state==="correct" && sx.optCorrect,
                state==="wrong" && sx.optWrong,
                state==="disabled" && sx.optDisabled,
                highContrast && sx.hcOption,
                pressed && !disabled && sx.optionPressed,
              ]}
            >
              <Text style={[sx.optionBullet, highContrast && sx.hcBullet]}>{letters[idx] || "•"}</Text>
              <Text style={[styles.optionText, highContrast && sx.hcOptionText]}>{String(opt)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const renderMatching = () => {
    const left = Array.isArray(question.left) ? question.left : [];
    const right = Array.isArray(question.right) ? question.right : [];
    return (
      <>
        <View style={[sx.questionCard, highContrast && sx.hcCard]}>
          <Text style={[styles.question, highContrast && { color: "#0B0B0B" }]}>{question.instructions || "Empareja cada elemento con su correspondencia."}</Text>
        </View>

        <View style={sx.matchWrap}>
          <View style={sx.col}>
            {left.map((txt, i) => {
              const pairedR = getRightOfLeft(i);
              const active = mLeftSel === i;
              return (
                <Pressable key={`L${i}`} onPress={() => onPressLeft(i)} style={[sx.matchItem, active && sx.matchActive, highContrast && sx.hcCard]}>
                  <Text style={[sx.matchText, highContrast && { color: "#0B0B0B" }]}>{String(txt)}</Text>
                  {Number.isInteger(pairedR) && <Text style={sx.pairBadge}>→ {pairedR+1}</Text>}
                </Pressable>
              );
            })}
          </View>

          <View style={sx.col}>
            {right.map((txt, j) => {
              const used = isRightUsed(j);
              return (
                <Pressable
                  key={`R${j}`}
                  onPress={() => onPressRight(j)}
                  disabled={mLeftSel === null}
                  style={[sx.matchItem, used && sx.matchUsed, mLeftSel===null && { opacity: 0.7 }, highContrast && sx.hcCard]}
                >
                  <Text style={[sx.matchText, highContrast && { color: "#0B0B0B" }]}>{String(txt)}</Text>
                  {used && <Text style={sx.pairBadge}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Pressable onPress={checkMatching} style={sx.checkBtn} disabled={locked || resultVisible || mPairs.length === 0}>
            <Text style={sx.checkText}>Comprobar</Text>
          </Pressable>
          {mPairs.length > 0 && (
            <Pressable onPress={() => { setMPairs([]); setMLeftSel(null); }} style={[sx.checkBtn, { backgroundColor:'#9CA3AF', marginTop:6 }]}>
              <Text style={sx.checkText}>Reiniciar emparejamientos</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  };

  return (
    <Container {...containerProps}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={sx.hudRow}>
          <View style={[sx.chip, highContrast && sx.hcChip]}><Text style={[sx.chipText, highContrast && sx.hcChipText]}>⭐ Puntos: {score}</Text></View>
          <View style={[sx.chip, highContrast && sx.hcChip]}><Text style={[sx.chipText, highContrast && sx.hcChipText]}>❤️ Vidas: {lives}/{livesMax} {msLeft ? `( +1 en ${nextLifeStr})` : ""}</Text></View>
          <View style={[sx.chip, highContrast && sx.hcChip]}><Text style={[sx.chipText, highContrast && sx.hcChipText]}>🔁 Intentos: {attemptsLeft}/{maxAttempts}</Text></View>
          <View style={[sx.chip, highContrast && sx.hcChip]}><Text style={[sx.chipText, highContrast && sx.hcChipText]}>🧩 Aciertos: {correctCount}/{LEVEL_TARGET}</Text></View>
        </View>

        <Text style={[styles.title, highContrast && { color: "#0B0B0B" }]}>{(LEVEL_LABELS[nivel] ?? String(nivel)).toUpperCase()}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {question.type === 'matching' && isMatchingWellFormed(question)
            ? renderMatching()
            : renderMultiple()}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={resultVisible && !levelCompleted} transparent animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setResultVisible(false)}>
        <View style={sx.modalBackdrop}>
          <View style={[sx.sheet, highContrast && sx.hcCard]}>
            <View style={sx.sheetHeader} />
            <Text style={[ sx.resultTitle, result==="correct" ? sx.resultOk : sx.resultBad, highContrast && (result==="correct" ? sx.hcOk : sx.hcBad) ]}>
              {result==="correct" ? "¡Correcto!" : "Respuesta incorrecta"}
            </Text>

            {result === "wrong" && pendingSpendLife ? (
              <>
                <Text style={sx.resultText}>Se agotaron los intentos. Aquí está la respuesta correcta:</Text>
                {renderCorrectFeedback()}
                <Text style={[sx.resultText, { marginTop: 10, fontStyle: 'italic' }]}>Presiona "Siguiente" para perder una vida y continuar.</Text>
              </>
            ) : (
              result === "wrong" ? <Text style={sx.resultText}>Inténtalo de nuevo si te quedan intentos.</Text> : null
            )}

            <Pressable onPress={canRetry ? () => setResultVisible(false) : onContinue} style={[sx.nextBtn, highContrast && sx.hcNextBtn]}>
              <Text style={[sx.nextBtnText, highContrast && sx.hcNextBtnText]}>
                {canRetry ? "Intentar de nuevo" : (pendingSpendLife ? "Siguiente (perder vida)" : "Siguiente")}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {levelCompleted && (
        <View style={sx.levelOverlay} pointerEvents="box-none">
          <View style={[sx.levelCard, highContrast && sx.hcCard]}>
            <Text style={[sx.levelTitle, highContrast && { color: "#0B0B0B" }]}>¡Nivel completado! 🎉</Text>
            <Text style={[sx.levelText, highContrast && { color: "#0B0B0B" }]}>Aciertos: {correctCount}/{LEVEL_TARGET}</Text>
            <Pressable onPress={finishLevel} style={[sx.finishBtn, highContrast && sx.hcNextBtn]}><Text style={[sx.finishBtnText, highContrast && sx.hcNextBtnText]}>Terminar</Text></Pressable>
          </View>
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,justifyContent:"flex-start",alignItems:"stretch",padding:16},
  title:{fontSize:28,fontWeight:"800",textAlign:"center",marginTop:8,marginBottom:16,color:"#1E3A8A",letterSpacing:0.5},
  question:{fontSize:18,textAlign:"center",color:"#0F172A",lineHeight:26},
  option:{flexDirection:"row",alignItems:"center",backgroundColor:"#1E3A8A",paddingVertical:14,paddingHorizontal:16,marginVertical:6,borderRadius:12,width:"100%",shadowColor:"#000",shadowOpacity:0.15,shadowOffset:{width:0,height:2},shadowRadius:6,elevation:4},
  optionText:{color:"#fff",fontSize:16,flexShrink:1},
  footer:{marginTop:18,fontSize:15,textAlign:"center",color:"#475569"},
});

const sx = StyleSheet.create({
  hudRow:{flexDirection:"row",justifyContent:"space-between",gap:8,marginBottom:4,flexWrap:"wrap"},
  chip:{backgroundColor:"#ffffff",borderColor:"#cbd5e1",borderWidth:1,borderRadius:999,paddingVertical:8,paddingHorizontal:14,alignSelf:"flex-start",shadowColor:"#000",shadowOpacity:0.06,shadowRadius:4,shadowOffset:{width:0,height:2},elevation:2},
  chipText:{color:"#1E293B",fontWeight:"700",fontSize:13,letterSpacing:0.3},

  questionCard:{backgroundColor:"#ffffff",borderRadius:16,borderWidth:1,borderColor:"#e2e8f0",padding:16,marginBottom:12,shadowColor:"#000",shadowOpacity:0.08,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:3},

  optionsWrap:{marginTop:4},
  optionPressed:{opacity:0.92,transform:[{scale:0.98}]},
  optionBullet:{color:"#93C5FD",fontWeight:"900",fontSize:16,marginRight:10},
  optCorrect:{backgroundColor:"#059669"},
  optWrong:{backgroundColor:"#dc2626"},
  optDisabled:{opacity:0.45},

  matchWrap:{flexDirection:'row', gap:10},
  col:{flex:1},
  matchItem:{
    backgroundColor:'#FFFFFF', borderColor:'#E2E8F0', borderWidth:1, borderRadius:12,
    paddingVertical:12, paddingHorizontal:10, marginBottom:8,
    shadowColor:'#000', shadowOpacity:0.05, shadowRadius:3, shadowOffset:{width:0,height:2}, elevation:2,
    flexDirection:'row', justifyContent:'space-between', alignItems:'center'
  },
  matchActive:{ borderColor:'#3B82F6', backgroundColor:'#EFF6FF' },
  matchUsed:{ opacity:0.8 },
  matchText:{ color:'#0F172A', fontSize:14, flexShrink:1 },
  pairBadge:{ color:'#1E3A8A', fontWeight:'900' },

  modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.35)",justifyContent:"flex-end"},
  sheet:{backgroundColor:"#fff",borderTopLeftRadius:18,borderTopRightRadius:18,padding:16,borderTopWidth:1,borderColor:"#e2e8f0"},
  sheetHeader:{width:44,height:5,borderRadius:999,backgroundColor:"#e5e7eb",alignSelf:"center",marginBottom:10},
  resultTitle:{fontSize:18,fontWeight:"800"},
  resultOk:{color:"#065f46"},
  resultBad:{color:"#7f1d1d"},
  resultText:{fontSize:15,color:"#1f2937",marginTop:6},
  resultStrong:{fontWeight:"900",color:"#111827"},
  nextBtn:{marginTop:12,backgroundColor:"#1E3A8A",paddingVertical:12,borderRadius:12,alignItems:"center"},
  nextBtnText:{color:"#fff",fontSize:16,fontWeight:"800"},

  levelOverlay:{position:"absolute",inset:0,justifyContent:"center",alignItems:"center",padding:16,backgroundColor:"rgba(0,0,0,0.25)"},
  levelCard:{width:"100%",maxWidth:520,backgroundColor:"#fff",borderRadius:18,borderWidth:1,borderColor:"#e2e8f0",padding:18,alignItems:"center",gap:8},
  levelTitle:{fontSize:22,fontWeight:"900",color:"#111827"},
  levelText:{fontSize:16,color:"#1f2937"},
  finishBtn:{marginTop:6,backgroundColor:"#1E3A8A",paddingVertical:12,paddingHorizontal:20,borderRadius:12,alignItems:"center"},
  finishBtnText:{color:"#fff",fontSize:16,fontWeight:"800"},

  hcChip:{backgroundColor:"#F2F2F2",borderColor:"#111"},
  hcChipText:{color:"#0B0B0B"},
  hcCard:{backgroundColor:"#FFFFFF",borderColor:"#111"},
  hcOption:{backgroundColor:"#111111"},
  hcOptionText:{color:"#FFFFFF"},
  hcBullet:{color:"#FFFFFF"},
  hcOk:{color:"#0B7A3B"},
  hcBad:{color:"#990000"},
  hcNextBtn:{backgroundColor:"#0B0B0B"},
  hcNextBtnText:{color:"#FFFFFF"},

  checkBtn:{backgroundColor:"#1E3A8A", paddingVertical:12, paddingHorizontal:16, borderRadius:12},
  checkText:{color:"#fff", fontWeight:'900'},
});
