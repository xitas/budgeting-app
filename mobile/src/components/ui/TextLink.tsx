import { StyleSheet, Text } from "react-native";
import { colors } from "./theme";

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={styles.link} suppressHighlighting={false}>
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.primary, fontSize: 14, paddingVertical: 4 },
});
