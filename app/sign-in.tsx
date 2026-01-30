import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Text, View } from "@/components/Themed";

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Enter your email to sign in.");
      return;
    }
    setLoading(true);
    const { error } = await signInWithEmail(trimmed);
    setLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    Alert.alert("Check your email", "We sent you a sign-in link.");
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to save recipes</Text>
      <Text style={styles.subtitle}>
        Enter your email and we'll send you a link to sign in. No password
        needed.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          loading && styles.disabled,
        ]}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Sending…" : "Send sign-in link"}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 16, opacity: 0.8, marginBottom: 24, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2f95dc",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  close: { marginTop: 24, alignItems: "center" },
  closeText: { fontSize: 16, opacity: 0.7 },
});
