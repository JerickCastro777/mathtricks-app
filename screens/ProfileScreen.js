// screens/ProfileScreen.jsx
import React, { useContext, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal } from 'react-native';
import { AppContext } from '../contexts/AppContext';
import ShopScreen from './ShopScreen';

const getTodayYMD = () => {
  const tz = 'America/Bogota';
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('es-CO', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export default function ProfileScreen({ onClose }) {
  const {
    user, signOut,
    highContrast, setHighContrast,
    reduceMotion, setReduceMotion,
    preloadNext, setPreloadNext,
  } = useContext(AppContext);

  const [shopVisible, setShopVisible] = useState(false);

  const { streak, bestStreak, xp, todayDone } = useMemo(() => {
    const p = user?.progress || {};
    const today = getTodayYMD();
    return {
      streak: Number(p.currentStreak || 0),
      bestStreak: Number(p.bestStreak || 0),
      xp: Number(p.xp || 0),
      todayDone: p.dailyChallengeCompletedDate === today,
    };
  }, [user]);

  const initials = (user?.fullName || user?.email || 'U')
    .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={sx.container}>
      <View style={sx.header}>
        <Text style={sx.headerTitle}>Perfil</Text>
        {onClose && (
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ fontWeight: '900' }}>Cerrar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={sx.scroll} showsVerticalScrollIndicator={false}>
        {/* Card usuario */}
        <View style={sx.card}>
          <View style={sx.avatar}><Text style={sx.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={sx.name}>{user?.fullName}</Text>
            <Text style={sx.sub}>{user?.email}</Text>
            {!!user?.course && <Text style={sx.sub}>Curso: {user.course}</Text>}
            {!!user?.documentId && <Text style={sx.sub}>Documento: {user.documentId}</Text>}
          </View>
        </View>

        {/* Métricas */}
        <View style={sx.row}>
          <View style={sx.stat}><Text style={sx.statLabel}>Racha</Text><Text style={sx.statValue}>🔥 {streak}</Text></View>
          <View style={sx.stat}><Text style={sx.statLabel}>Mejor racha</Text><Text style={sx.statValue}>🏅 {bestStreak}</Text></View>
          <View style={sx.stat}><Text style={sx.statLabel}>XP</Text><Text style={sx.statValue}>⭐ {xp}</Text></View>
        </View>

        {/* Estado de hoy */}
        <View style={[sx.pill, { backgroundColor: todayDone ? '#DCFCE7' : '#FEE2E2', borderColor: todayDone ? '#16A34A' : '#DC2626' }]}>
          <Text style={[sx.pillText, { color: todayDone ? '#166534' : '#991B1B' }]}>
            {todayDone ? '✅ Reto de hoy completado' : '⏳ Aún no has completado el reto de hoy'}
          </Text>
        </View>

        {/* Configuración */}
        <View style={sx.settingsCard}>
          <Text style={sx.settingsTitle}>Configuración</Text>

          <RowSwitch
            title="Modo alto contraste"
            subtitle="Interfaz formal, mínima y con colores reducidos."
            value={highContrast}
            onValueChange={setHighContrast}
          />

          <RowSwitch
            title="Reducir animaciones"
            subtitle="Evita sacudidas, pulsos y transiciones prolongadas."
            value={reduceMotion}
            onValueChange={setReduceMotion}
          />

          <Pressable onPress={() => setShopVisible(true)} style={sx.shopBtn}>
            <Text style={sx.shopBtnText}>🛒 Abrir tienda</Text>
          </Pressable>
        </View>

        <Pressable style={sx.signoutBtn} onPress={signOut}>
          <Text style={sx.signoutText}>Cerrar sesión</Text>
        </Pressable>

        <View style={{ height: 28 }} />
      </ScrollView>

      <Modal visible={shopVisible} animationType="slide" onRequestClose={() => setShopVisible(false)}>
        <ShopScreen onClose={() => setShopVisible(false)} />
      </Modal>
    </SafeAreaView>
  );
}

function RowSwitch({ title, subtitle, value, onValueChange }) {
  return (
    <View style={sx.rowSwitch}>
      <View style={{ flex: 1 }}>
        <Text style={sx.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={sx.rowSub}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const sx = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  scroll: { padding: 16 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 999, backgroundColor: '#1E3A8A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  name: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sub: { color: '#334155', marginTop: 2 },

  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  statValue: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 4 },

  pill: { alignSelf: 'flex-start', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, marginBottom: 14 },
  pillText: { fontWeight: '800' },

  settingsCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 },
  settingsTitle: { fontWeight: '900', fontSize: 16, color: '#0F172A', marginBottom: 8 },

  rowSwitch: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowTitle: { fontWeight: '800', color: '#0F172A' },
  rowSub: { color: '#64748B', marginTop: 2, fontSize: 12 },

  shopBtn: { marginTop: 8, backgroundColor: '#1E3A8A', borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  shopBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  signoutBtn: { backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 4, marginTop: 12 },
  signoutText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
