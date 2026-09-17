import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Bot } from "lucide-react-native";
import { iconStroke } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { responderLabel } from "@/services/ai";
import type { ChatMessage } from "@/stores/chatStore";
import { Button, Disclosure, IconBox, KeyValueRow, AppText } from "@/components/ui";

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  showContext?: boolean;
}

/** Canvas chat bubble: "me" messages are an accent-tinted box on the right; assistant replies sit beside a bot avatar. */
export function ChatBubble({ message, onRetry, showContext = true }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={[styles.bubble, { backgroundColor: colors.accentTint, borderColor: colors.accent }]} accessibilityLabel={`You asked: ${message.text}`}>
          <AppText variant="body">{message.text}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <IconBox size={32} borderColor={colors.divider}>
        <Bot size={16} color={colors.accent} strokeWidth={iconStroke} />
      </IconBox>
      <View style={styles.assistantColumn}>
        <View style={[styles.bubble, { borderColor: colors.divider }]} accessibilityLabel={message.status === "sending" ? "Assistant is thinking" : `Assistant: ${message.text}`}>
          {message.status === "sending" ? (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={colors.accent} />
              <AppText variant="body" tone="muted">
                Looking at the survey's measurements…
              </AppText>
            </View>
          ) : message.status === "error" ? (
            <View style={styles.thinking}>
              <AppText variant="body" tone="problem" style={styles.flex}>
                {message.errorMessage ?? "The assistant could not answer."}
              </AppText>
              {onRetry ? <Button label="Retry" size="sm" variant="secondary" onPress={onRetry} /> : null}
            </View>
          ) : (
            <AppText variant="body" selectable>
              {message.text}
            </AppText>
          )}
        </View>
        {message.responder ? (
          <AppText variant="small" tone="muted" style={styles.meta}>
            Answered by {responderLabel(message.responder)}
          </AppText>
        ) : null}
        {showContext && message.contextUsed && Object.keys(message.contextUsed).length > 0 ? (
          <Disclosure showLabel="What the assistant looked at" hideLabel="Hide what the assistant looked at">
            {Object.entries(message.contextUsed)
              .filter(([, v]) => v != null && typeof v !== "object")
              .map(([k, v], i, arr) => (
                <KeyValueRow key={k} label={k.replace(/_/g, " ")} value={String(v)} last={i === arr.length - 1} />
              ))}
          </Disclosure>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  rowUser: { justifyContent: "flex-end" },
  assistantColumn: { flex: 1, gap: 4, maxWidth: "88%" },
  bubble: { borderWidth: 1, borderRadius: 0, padding: 12 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  meta: { paddingLeft: 4 },
  flex: { flex: 1, minWidth: 120 },
});
