import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { CenteredMessage, FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import {
  findCachedTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from "../../../features/transactions/hooks";
import { TransactionForm } from "../../../features/transactions/TransactionForm";
import { confirmDestructive } from "../../../lib/confirm";
import { extractErrorMessage } from "../../../lib/errors";

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  // Snapshot once: the row must not change under the form while it's open.
  const [tx] = useState(() => findCachedTransaction(queryClient, id));
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!tx) {
    return <CenteredMessage>This transaction isn&apos;t loaded any more. Go back and try again.</CenteredMessage>;
  }

  async function handleDelete(): Promise<void> {
    if (!(await confirmDestructive("Delete transaction?", "This can't be undone."))) return;
    setDeleteError(null);
    try {
      await deleteTransaction.mutateAsync(id);
      router.back();
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <TransactionForm
        defaultValues={{
          type: tx.type,
          category: tx.category.id,
          amount: tx.amount,
          description: tx.description,
          date: tx.date.slice(0, 10),
        }}
        submitLabel="Save changes"
        onSubmit={async (values) => {
          await updateTransaction.mutateAsync({ id, updates: values });
          router.back();
        }}
      />
      {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}
      <Button title="Delete transaction" variant="ghost" onPress={() => void handleDelete()} disabled={deleteTransaction.isPending} />
    </FormScreen>
  );
}
