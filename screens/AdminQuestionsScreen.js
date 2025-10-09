// screens/AdminQuestionsScreen.jsx
import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { AppContext } from '../contexts/AppContext';

// Valores seguros + etiquetas con ortografía correcta
const CATS = [
  { value: 'fracciones', label: 'Fracciones' },
  { value: 'algebra', label: 'Álgebra' },
  { value: 'ecuaciones', label: 'Ecuaciones' },
];

const LEVELS = [
  { value: 'facil', label: 'Fácil' },
  { value: 'medio', label: 'Medio' },
  { value: 'dificil', label: 'Difícil' },
];

export default function AdminQuestionsScreen() {
  const { user, createQuestionsBatch } = useContext(AppContext);
  const [category, setCategory] = useState(CATS[0].value);
  const [level, setLevel] = useState(LEVELS[0].value);
  const [count, setCount] = useState('20');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!user?.isAdmin) {
      Toast.show({ type: 'error', text1: 'No autorizado' });
      return;
    }
    const n = Math.max(1, Math.min(200, parseInt(count || '0', 10)));
    setBusy(true);
    const res = await createQuestionsBatch({ category, level, count: n });
    setBusy(false);
    Toast.show({
      type: 'success',
      text1: '¡Listo!',
      text2: `Se guardaron ${res.length} preguntas nuevas.`,
    });
  };

  if (!user?.isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>No autorizado</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Generar y guardar preguntas</Text>

      <Text style={{ fontSize: 16, marginTop: 8 }}>Categoría</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {CATS.map(c => (
          <TouchableOpacity
            key={c.value}
            onPress={() => setCategory(c.value)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: category === c.value ? '#1E3A8A' : '#e2e8f0',
            }}
          >
            <Text style={{ color: category === c.value ? 'white' : '#0f172a', fontWeight: '600' }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 16, marginTop: 8 }}>Nivel</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {LEVELS.map(l => (
          <TouchableOpacity
            key={l.value}
            onPress={() => setLevel(l.value)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: level === l.value ? '#1E3A8A' : '#e2e8f0',
            }}
          >
            <Text style={{ color: level === l.value ? 'white' : '#0f172a', fontWeight: '600' }}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 16, marginTop: 8 }}>Cantidad</Text>
      <TextInput
        keyboardType="number-pad"
        value={count}
        onChangeText={setCount}
        placeholder="p. ej., 50"
        style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 16 }}
      />

      <TouchableOpacity
        onPress={onCreate}
        disabled={busy}
        style={{
          backgroundColor: busy ? '#64748b' : '#22c55e',
          padding: 14,
          borderRadius: 12,
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
          {busy ? 'Generando…' : 'Generar y guardar'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
