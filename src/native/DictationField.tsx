import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  TaskHintIOS,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { mergeDictation } from "@/native/dictation";
import { nativeColors as colors } from "@/native/theme";
import { Field } from "@/native/ui";

type DictationFieldProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  onDictatingChange?: (dictating: boolean) => void;
};

function showPermissionAlert() {
  Alert.alert(
    "Voice input needs access",
    "Allow Chefness to use the microphone and speech recognition in iOS Settings.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ],
  );
}

export function DictationField({
  value,
  onChangeText,
  containerStyle,
  onDictatingChange,
  editable = true,
  ...props
}: DictationFieldProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const active = useRef(false);
  const draft = useRef("");
  const isDictating = isStarting || isListening;

  useEffect(() => {
    onDictatingChange?.(isDictating);
  }, [isDictating, onDictatingChange]);

  useEffect(
    () => () => {
      if (!active.current) return;
      active.current = false;
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  useSpeechRecognitionEvent("start", () => {
    if (!active.current) return;
    setIsStarting(false);
    setIsListening(true);
    AccessibilityInfo.announceForAccessibility("Listening");
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!active.current) return;
    const transcript = event.results[0]?.transcript;
    if (transcript) onChangeText(mergeDictation(draft.current, transcript));
  });

  useSpeechRecognitionEvent("end", () => {
    if (!active.current) return;
    active.current = false;
    setIsStarting(false);
    setIsListening(false);
    AccessibilityInfo.announceForAccessibility("Voice input stopped");
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!active.current) return;
    active.current = false;
    setIsStarting(false);
    setIsListening(false);
    if (event.error === "aborted" || event.error === "no-speech") return;
    if (event.error === "not-allowed") return showPermissionAlert();
    Alert.alert(
      "Voice input unavailable",
      event.error === "network"
        ? "Speech recognition needs a network connection on this device."
        : "Chefness couldn’t recognize speech. Please try again.",
    );
  });

  const start = async () => {
    setIsStarting(true);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setIsStarting(false);
        Alert.alert(
          "Voice input unavailable",
          "Speech recognition isn’t available on this device.",
        );
        return;
      }
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setIsStarting(false);
        showPermissionAlert();
        return;
      }

      draft.current = value;
      active.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        iosTaskHint: TaskHintIOS.dictation,
      });
    } catch {
      active.current = false;
      setIsStarting(false);
      Alert.alert(
        "Voice input unavailable",
        "Chefness couldn’t start speech recognition. Please try again.",
      );
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Field
        {...props}
        editable={editable && !isDictating}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, props.style]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isListening ? "Stop voice input" : "Start voice input"
        }
        accessibilityState={{ disabled: !editable || isStarting }}
        disabled={!editable || isStarting}
        onPress={
          isListening
            ? () => ExpoSpeechRecognitionModule.stop()
            : () => void start()
        }
        style={[
          styles.microphone,
          isListening && styles.microphoneListening,
          (!editable || isStarting) && styles.disabled,
        ]}
      >
        <Ionicons
          accessible={false}
          name={isListening ? "stop-circle" : "mic-outline"}
          size={27}
          color={isListening ? colors.danger : colors.saffronDeep}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 4 },
  input: { flex: 1 },
  microphone: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  microphoneListening: { backgroundColor: colors.dangerTint },
  disabled: { opacity: 0.5 },
});
