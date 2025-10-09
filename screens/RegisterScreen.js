import React, { useContext, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppContext } from '../contexts/AppContext';
import styles from '../styles/styles';
import Toast from 'react-native-toast-message';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [course, setCourse] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp } = useContext(AppContext);

  const handleRegister = () => {
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Las contraseñas no coinciden.',
      });
      return;
    }
    signUp(fullName, documentId, course, email, password);
  };

  return (
    <View style={styles.authContainer}>
      <View style={styles.card}>
        <Text style={styles.authTitle}>Registrarse</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          placeholderTextColor="#3E4C59"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Documento de identidad"
          placeholderTextColor="#3E4C59"
          keyboardType="numeric"
          value={documentId}
          onChangeText={setDocumentId}
        />

        <TextInput
          style={styles.input}
          placeholder="Curso"
          placeholderTextColor="#3E4C59"
          value={course}
          onChangeText={setCourse}
        />

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#3E4C59"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#3E4C59"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña"
          placeholderTextColor="#3E4C59"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>Registrarse</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
