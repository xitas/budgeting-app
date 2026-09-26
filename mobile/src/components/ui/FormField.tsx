import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius } from "./theme";

interface FormFieldProps<T extends FieldValues> extends Omit<TextInputProps, "value" | "onChangeText" | "onBlur"> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  error?: string;
}

// react-hook-form's register() targets DOM inputs; React Native inputs go
// through Controller instead.
export function FormField<T extends FieldValues>({ control, name, label, error, style, ...inputProps }: FormFieldProps<T>) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            // Edit forms seed numbers (amounts); a TextInput only takes strings.
            value={value === undefined || value === null ? "" : String(value)}
            onChangeText={onChange}
            onBlur={onBlur}
            accessibilityLabel={label}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, error ? styles.inputError : null, style]}
            {...inputProps}
          />
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger },
});
