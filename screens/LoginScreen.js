import React, { useContext, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppContext } from '../contexts/AppContext';
import styles from '../styles/styles';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useContext(AppContext);

  return (
    <View style={styles.authContainer}>
      <View style={styles.card}>
        <Text style={styles.authTitle}>Iniciar sesión</Text>
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#3E4C59"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#3E4C59"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.button} onPress={() => signIn(username, password)}>
          <Text style={styles.buttonText}>Ingresar al sistema</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>¿No tienes cuenta? Regístrate aquí</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
