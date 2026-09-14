import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { responderLabel } from "@/services/ai";
import type { ChatMessage } from "@/stores/chatStore";
import { Button, Disclosure, KeyValueRow, AppText } from "@/components/ui";

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  showContext?: boolean;
}

export function ChatBubble({ message, onRetry, showContext = true }: ChatBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: colors.brand }]} accessibilityLabel={`You asked: ${message.text}`}>
          <AppText variant="body" tone="onBrand">
            {message.text}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}>
        <Sparkles size={16} color={colors.brand} />
      </View>
      <View style={styles.assistantColumn}>
        <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={message.status === "sending" ? "Assistant is thinking" : `Assistant: ${message.text}`}>
          {message.status === "sending" ? (
            <View style={styles.thinking}>
              <ActivityIndicator size="small" color={colors.brand} />
              <AppText variant="body" tone="muted">
                Looking at the survey's measurements…
              </AppText>
            </View>
          ) : message.status === "error" ? (
            <View style={styles.thinking}>
              <AppText variant="body" tone="problem" style={styles.flex}>
                {message.errorMessage ?? "The assistant could not answer."}
              </AppText>
              {onRetry ? <Button label="Retry" size="sm" variant="outline" onPress={onRetry} /> : null}
            </View>
          ) : (
            <AppText variant="body" selectable>
              {message.text}
            </AppText>
          )}
        </View>
        {message.responder ? (
          <AppText variant="caption" tone="muted" style={styles.meta}>
            Answered by {responderLabel(message.responder)}
          </AppText>
        ) : null}
        {showContext && message.contextUsed && Object.keys(message.contextUsed).length > 0 ? (
          <Disclosure title="What the assistant looked at" subtitle="Structured data from the backend analysis — the AI never looks at raw images">
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
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  rowUser: { justifyContent: "flex-end" },
  avatar: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  assistantColumn: { flex: 1, gap: spacing.xs, maxWidth: "88%" },
  bubble: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md, borderBottomLeftRadius: radius.sm },
  bubbleUser: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.sm, maxWidth: "85%", borderWidth: 0 },
  thinking: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  meta: { paddingLeft: spacing.xs },
  flex: { flex: 1, minWidth: 120 },
});
