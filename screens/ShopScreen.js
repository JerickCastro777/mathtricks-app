// screens/ShopScreen.jsx
import React, { useContext, useMemo, useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { AppContext } from '../contexts/AppContext';

export default function ShopScreen({ onClose }) {
  const {
    user,
    buyLifeWithXP,
    upgradeLivesMax,
    reduceRecoveryTime,
    upgradeAttempts,
    timeToNextLifeMs,
  } = useContext(AppContext);

  const p = user?.progress || {};
  const { xp, lives, livesMax, lifeRecoveryMinutes, maxAttemptsPerQuestion } = p;

  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatHMS = (ms) => {
    if (!ms || ms <= 0) return '00:00:00';
    const total = Math.ceil(ms / 1000); 
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  
  const msLeft = timeToNextLifeMs() + (nowTick && 0);
  const nextLifeStr = msLeft ? formatHMS(msLeft) : '—';

  const items = useMemo(() => ([
    {
      key: 'life',
      title: 'Recargar 1 vida',
      desc: 'Añade una vida inmediata (hasta tu máximo).',
      price: 50,
      action: async () => buyLifeWithXP(50),
      disabled: lives >= livesMax,
      badge: `Vidas ${lives}/${livesMax} ${msLeft ? `(+1 en ${nextLifeStr})` : ''}`,
    },
    {
      key: 'max',
      title: 'Aumentar vidas máximas',
      desc: 'Sube tu límite de vidas hasta 10.',
      priceDynamic: true,
      action: upgradeLivesMax,
      disabled: livesMax >= 10,
      badge: `${livesMax} → ${Math.min(10, livesMax + 1)}`,
      priceHint: 150 + Math.max(0, livesMax - 5) * 50,
    },
    {
      key: 'recovery',
      title: 'Reducir tiempo de recuperación',
      desc: 'Recupera una vida más rápido (mínimo: 30 min).',
      priceDynamic: true,
      action: reduceRecoveryTime,
      disabled: lifeRecoveryMinutes <= 30,
      badge: `${lifeRecoveryMinutes} min`,
      priceHint: lifeRecoveryMinutes > 60 ? 200 : 300,
    },
    {
      key: 'attempts',
      title: 'Más intentos por pregunta',
      desc: 'Aumenta de 2 hasta un máximo de 3.',
      price: 250,
      action: upgradeAttempts,
      disabled: maxAttemptsPerQuestion >= 3,
      badge: `${maxAttemptsPerQuestion} → ${Math.min(3, (maxAttemptsPerQuestion || 2) + 1)}`,
    },
  ]), [lives, livesMax, lifeRecoveryMinutes, maxAttemptsPerQuestion, upgradeLivesMax, reduceRecoveryTime, upgradeAttempts, buyLifeWithXP, msLeft, nextLifeStr]);

  return (
    <SafeAreaView style={sx.container}>
      <View style={sx.header}>
        <Text style={sx.title}>Tienda</Text>
        <Pressable onPress={onClose} style={sx.closeBtn}><Text style={sx.closeText}>Cerrar</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={sx.scroll}>
        <View style={sx.wallet}>
          <Text style={sx.walletText}>⭐ XP disponible: <Text style={sx.walletStrong}>{xp ?? 0}</Text></Text>
        </View>

        {items.map((it) => {
          const price = it.priceDynamic ? it.priceHint : it.price;
          const disabled = !!it.disabled || (xp ?? 0) < (price ?? 0);
          return (
            <View key={it.key} style={sx.card}>
              <View style={{ flex: 1 }}>
                <Text style={sx.itemTitle}>{it.title}</Text>
                <Text style={sx.itemSub}>{it.desc}</Text>
                <View style={sx.badge}><Text style={sx.badgeText}>{it.badge}</Text></View>
              </View>
              <Pressable onPress={it.action} disabled={disabled} style={[sx.buyBtn, disabled && { opacity: 0.5 }]}>
                <Text style={sx.buyText}>Comprar {price ? `(${price} XP)` : ''}</Text>
              </Pressable>
            </View>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sx = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  closeBtn: { padding: 8 },
  closeText: { fontWeight: '900', color: '#1E3A8A' },

  scroll: { padding: 16 },
  wallet: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  walletText: { color: '#1E293B', fontWeight: '700' },
  walletStrong: { fontWeight: '900' },

  card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, alignItems: 'center', marginBottom: 10 },
  itemTitle: { fontWeight: '900', color: '#0F172A' },
  itemSub: { color: '#475569', marginTop: 2 },
  badge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '800', color: '#0F172A', fontSize: 12 },

  buyBtn: { backgroundColor: '#1E3A8A', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  buyText: { color: '#fff', fontWeight: '900' },
});
