import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Mic, SendHorizontal } from "lucide-react-native";
import { iconStroke, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { IconButton } from "@/components/ui";

interface ChatComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Voice extension point: when provided, the microphone button becomes
   * active and should start speech-to-text, then call onSend with the
   * transcript. Not wired in the MVP.
   */
  onVoice?: () => void;
}

/** Canvas composer bar: hairline input, 50 px accent send square, mic on the left (design: text/voice input row). */
export function ChatComposer({ onSend, disabled = false, placeholder = "Ask about your field…", onVoice }: ChatComposerProps) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
  };

  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.divider }]}>
      <IconButton icon={<Mic size={20} color={onVoice ? colors.text : colors.muted} strokeWidth={iconStroke} />} accessibilityLabel={onVoice ? "Ask by voice" : "Voice input coming soon"} onPress={onVoice} disabled={!onVoice} size={44} />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={500}
        editable={!disabled}
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={submit}
        accessibilityLabel="Your question"
        style={[styles.input, typography.body, { color: colors.text, borderColor: colors.divider }]}
      />
      <IconButton
        tone={canSend ? "primary" : "plain"}
        icon={<SendHorizontal size={20} color={canSend ? colors.onAccent : colors.muted} strokeWidth={iconStroke} />}
        accessibilityLabel="Send question"
        onPress={submit}
        disabled={!canSend}
        size={44}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
