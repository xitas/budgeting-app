import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDisplayDate, isoToLocalDate, localDateToIso } from "../../lib/dates";
import { colors, radius } from "./theme";

interface DateFieldProps {
  label: string;
  value: string | undefined; // "YYYY-MM-DD"
  onChange: (iso: string) => void;
  error?: string;
  placeholder?: string;
  onClear?: () => void; // shown only when set — for optional dates
}

// Native pickers: Android opens its system dialog; iOS expands an inline
// calendar under the field.
export function DateField({ label, value, onChange, error, placeholder = "Pick a date", onClear }: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? isoToLocalDate(value) : new Date();

  function open(): void {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        onValueChange: (_event, date) => onChange(localDateToIso(date)),
      });
    } else {
      setIosOpen((prev) => !prev);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDisplayDate(value) : "not set"}`}
          onPress={open}
          style={[styles.input, error ? styles.inputError : null]}
        >
          <Text style={value ? styles.value : styles.placeholder}>{value ? formatDisplayDate(value) : placeholder}</Text>
        </Pressable>
        {onClear && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS === "ios" && iosOpen ? (
        <DateTimePicker
          value={current}
          mode="date"
          display="inline"
          onValueChange={(_event, date) => {
            onChange(localDateToIso(date));
            setIosOpen(false);
          }}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  value: { fontSize: 15, color: colors.text },
  placeholder: { fontSize: 15, color: colors.textSubtle },
  clear: { fontSize: 14, color: colors.primary },
  error: { fontSize: 13, color: colors.danger },
});
