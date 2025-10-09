import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // tono más limpio y moderno
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 24,
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },

  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },

  authTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 28,
    color: '#1E3A8A',
    textAlign: 'center',
  },

  input: {
    width: '100%',
    height: 52,
    borderColor: '#CBD5E1', // gris suave, menos agresivo
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    color: '#334155',
    fontSize: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },

  linkText: {
    color: '#2563EB',
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  highlightText: {
    color: '#FACC15',
    fontWeight: 'bold',
    fontSize: 16,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
  },

  headerButton: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },

  profileTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    color: '#0F172A',
    textAlign: 'center',
  },

  profileText: {
    fontSize: 18,
    marginBottom: 20,
    color: '#475569',
    textAlign: 'center',
  },

  closeButton: {
    marginTop: 14,
  },

  closeButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
