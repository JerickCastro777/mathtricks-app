import React, { useContext, useLayoutEffect, useMemo, useState, useRef, useEffect } from 'react';
import { ScrollView, Text, Pressable, View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../contexts/AppContext';
import styles from '../styles/styles';

const CATEGORY_THEMES = {
  fracciones: { label: 'Fracciones', emoji: '🧮', gradient: ['#C7F9CC', '#80ED99', '#34A0A4'] },
  algebra:    { label: 'Álgebra',    emoji: '🔢', gradient: ['#E9D5FF', '#C4B5FD', '#818CF8'] },
  igualdades: { label: 'Igualdades', emoji: '🧩', gradient: ['#BAE6FD', '#7DD3FC', '#38BDF8'] },
};

const LEVELS = [
  { key: 'facil',   label: 'FÁCIL',   stars: '⭐',   colors: ['#A7F3D0', '#60A5FA'] },
  { key: 'medio',   label: 'MEDIO',   stars: '⭐⭐',  colors: ['#FDE68A', '#60A5FA'] },
  { key: 'dificil', label: 'DIFÍCIL', stars: '⭐⭐⭐', colors: ['#FCA5A5', '#60A5FA'] },
];

const CONTINUOUS_LEVEL_GRADIENT = ['#8EDBD1', '#A7F3D0', '#FDE68A', '#F7B2B7', '#FCA5A5'];

const getTodayYMD = () => {
  const tz = 'America/Bogota';
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('es-CO', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export default function HomeScreen({ navigation }) {
  const { user, highContrast } = useContext(AppContext);
  const [openCat, setOpenCat] = useState(null);

  const { streak, todayDone } = useMemo(() => {
    const p = user?.progress || {};
    const today = getTodayYMD();
    return { streak: Number(p.currentStreak || 0), todayDone: p.dailyChallengeCompletedDate === today };
  }, [user]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleStyle: { fontWeight: '800', fontSize: 20, color: '#fff', letterSpacing: 0.6 },
      headerTintColor: '#fff',
      headerBackground: () =>
        highContrast
          ? <View style={{ flex: 1, backgroundColor: '#0B0B0B' }} />
          : <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />,
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Perfil')}
          style={({ pressed }) => [
            {
              marginRight: 10,
              backgroundColor: todayDone ? '#10B981' : '#F59E0B',
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>🔥 {streak} {streak === 1 ? 'día' : 'días'}</Text>
        </Pressable>
      ),
      headerShadowVisible: false,
    });
  }, [navigation, streak, todayDone, highContrast]);

  const toggleCat = (key) => setOpenCat((prev) => (prev === key ? null : key));

  const goToLevel = (nivel, colors, categoryKey) => {
    navigation.navigate('ExerciseScreen', {
      nivel, colors, category: categoryKey,
      moduleTheme: CATEGORY_THEMES[categoryKey]?.gradient || colors,
    });
  };

  const goToTimeAttack = () => {
    navigation.navigate('TimeAttackScreen', {
      nivel: 'medio',
      totalMs: 2 * 60 * 1000,
      target: 5,
    });
  };

  const Container = highContrast ? View : LinearGradient;
  const containerProps = highContrast
    ? { style: { flex: 1, backgroundColor: '#F2F2F2' } }
    : { colors: ['#E0F2FE', '#BFDBFE', '#93C5FD'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, style: { flex: 1 } };

  return (
    <Container {...containerProps}>
      <ScrollView contentContainerStyle={hs.scroll}>
        <Text style={[styles.title, highContrast && { color: '#0B0B0B' }]}>Elige tu práctica</Text>

        {/* Modos */}
        <Text style={[hs.sectionTitle, highContrast && { color: '#0B0B0B' }]}>Modos</Text>
        <View style={{ width: '100%', gap: 12 }}>
          <LinearGradient
            colors={highContrast ? ['#FFFFFF','#F4F4F4'] : ['#34d399','#10b981']}
            start={{x:0,y:0}} end={{x:1,y:1}}
            style={{ borderRadius: 16 }}
          >
            <Pressable
              onPress={goToTimeAttack}
              style={({pressed})=>[hs.card, pressed && hs.cardPressed, { justifyContent:'space-between' }]}
            >
              <Text style={[hs.cardText, { color: highContrast ? '#0B0B0B' : '#052e16' }]}>A contrarreloj (2:00)</Text>
              <Text style={[hs.cardEmoji, { fontSize: 20 }, highContrast && { color:'#0B0B0B' }]}>⏱️</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Categorías */}
        <Text style={[hs.sectionTitle, { marginTop: 16 }, highContrast && { color: '#0B0B0B' }]}>Categorías</Text>
        <View style={{ width: '100%', gap: 12 }}>
          {Object.entries(CATEGORY_THEMES).map(([key, cfg]) => (
            <CategoryBar
              key={key}
              categoryKey={key}
              cfg={cfg}
              open={openCat === key}
              onToggle={() => toggleCat(key)}
              onSelectLevel={(lvl) => {
                const lvlCfg = LEVELS.find((l) => l.key === lvl);
                if (lvlCfg) goToLevel(lvlCfg.key, lvlCfg.colors, key);
              }}
              highContrast={highContrast}
            />
          ))}
        </View>
      </ScrollView>
    </Container>
  );
}

function CategoryBar({ categoryKey, cfg, open, onToggle, onSelectLevel, highContrast }) {
  const { reduceMotion } = useContext(AppContext);

  // animaciones
  const heightAnim = useRef(new Animated.Value(0)).current; // height → JS driver
  const opacityAnim = useRef(new Animated.Value(0)).current; // opacity → native driver
  const rotateAnim  = useRef(new Animated.Value(open ? 1 : 0)).current;

  // medición del contenido
  const [contentH, setContentH] = useState(0);
  const measuredRef = useRef(false);

  // contenido reutilizable (visible e "invisible" para medir)
  const LevelsContent = ({ forMeasure = false }) => (
    <View
      style={forMeasure ? { position: 'absolute', left: -9999, opacity: 0 } : null}
      onLayout={(e) => {
        if (forMeasure) {
          const h = e.nativeEvent.layout.height || 0;
          if (!measuredRef.current && h > 0) {
            measuredRef.current = true;
            setContentH(h);
          }
        }
      }}
    >
      <View
        style={[
          hs.segmentedWrap,
          { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
          highContrast && { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111', shadowOpacity: 0 }
        ]}
      >
        {!highContrast && (
          <>
            <LinearGradient colors={cfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <View style={hs.blendOverlay} pointerEvents="none" />
          </>
        )}

        <LinearGradient
          colors={highContrast ? ['#FFFFFF', '#F7F7F7'] : CONTINUOUS_LEVEL_GRADIENT}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={hs.continuousBg}
        />

        <View style={hs.segmentedRow}>
          {LEVELS.map((lv, i) => (
            <View key={lv.key} style={[hs.segCol]}>
              <Pressable
                onPress={() => onSelectLevel(lv.key)}
                style={({ pressed }) => [hs.segPress, pressed && { opacity: 0.96 }]}
                android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
              >
                <Text style={[hs.segStars, highContrast && { color: '#0B0B0B' }]}>{lv.stars}</Text>
                <Text style={[hs.segLabel, highContrast && { color: '#0B0B0B' }]}>{lv.label}</Text>
              </Pressable>
              {i < LEVELS.length - 1 && <View style={[hs.softDivider, highContrast && { backgroundColor: '#DDD' }]} />}
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // animación open/close (usa contentH medido)
  useEffect(() => {
    const dur = reduceMotion ? 0 : 230;
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: open ? contentH : 0, duration: dur, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: open ? 1 : 0, duration: dur, useNativeDriver: true }),
      Animated.timing(rotateAnim,  { toValue: open ? 1 : 0, duration: dur, useNativeDriver: true }),
    ]).start();
  }, [open, contentH, reduceMotion, heightAnim, opacityAnim, rotateAnim]);

  const arrowRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  const BarBG = highContrast ? View : LinearGradient;
  const barProps = highContrast
    ? { style: [hs.cardWrap, open && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111' }] }
    : { colors: cfg.gradient, start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, style: [hs.cardWrap, open && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }] };

  return (
    <View>
      {/* medidor oculto: calcula contentH una vez */}
      {!measuredRef.current && <LevelsContent forMeasure />}

      <BarBG {...barProps}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [hs.card, pressed && hs.cardPressed]}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <Text style={[hs.cardText, highContrast && { color: '#0B0B0B' }]}>{cfg.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[hs.cardEmoji, highContrast && { color: '#0B0B0B' }]}>{cfg.emoji}</Text>
            <Animated.Text style={{ transform: [{ rotate: arrowRotate }], fontSize: 18, color: highContrast ? '#0B0B0B' : '#000' }}>›</Animated.Text>
          </View>
        </Pressable>
      </BarBG>

      {/* contenedor animado: height afuera (JS), opacity adentro (native) */}
      <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
        <Animated.View style={{ opacity: opacityAnim }}>
          <LevelsContent />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const hs = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 16, justifyContent: 'flex-start', alignItems: 'center' },
  sectionTitle: { width: '100%', fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 8 },

  cardWrap: { borderRadius: 16 },
  card: {
    borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 6,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },
  cardEmoji: { fontSize: 22, marginLeft: 10 },
  cardText: { color: '#0F172A', fontWeight: '800', fontSize: 18, letterSpacing: 0.6 },

  segmentedWrap: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  blendOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.28)' },
  continuousBg: { height: '100%', width: '100%', position: 'absolute', opacity: 0.92 },
  segmentedRow: { flexDirection: 'row', alignItems: 'stretch' },
  segCol: { flex: 1, position: 'relative' },
  segPress: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 2 },
  segStars: { fontSize: 16, textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  segLabel: { color: '#0F172A', fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  softDivider: { position: 'absolute', right: -0.5, top: 10, bottom: 10, width: 1, backgroundColor: 'rgba(255,255,255,0.38)' },
});
