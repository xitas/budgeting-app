import { StyleSheet, Text } from "react-native";
import { type Colors } from "./theme";
import { useThemedStyles } from "../../context/ThemeContext";

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text accessibilityRole="link" onPress={onPress} style={styles.link} suppressHighlighting={false}>
      {title}
    </Text>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    link: { color: colors.link, fontSize: 14, paddingVertical: 4 },
  });
