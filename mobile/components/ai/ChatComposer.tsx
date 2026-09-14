import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Mic, SendHorizontal } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
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
    <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <IconButton
        icon={<Mic size={20} color={onVoice ? colors.text : colors.textMuted} />}
        accessibilityLabel={onVoice ? "Ask by voice" : "Voice input coming soon"}
        onPress={onVoice}
        disabled={!onVoice}
        size={44}
      />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        editable={!disabled}
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={submit}
        accessibilityLabel="Your question"
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: colors.border }]}
      />
      <IconButton
        icon={<SendHorizontal size={20} color={canSend ? colors.onBrand : colors.textMuted} />}
        accessibilityLabel="Send question"
        onPress={submit}
        disabled={!canSend}
        size={44}
        style={canSend ? { backgroundColor: colors.brand, borderColor: colors.brand } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
});
