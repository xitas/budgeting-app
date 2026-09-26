import { router } from "expo-router";
import { FormScreen } from "../../../components/ui/layout";
import { useCreateTransaction } from "../../../features/transactions/hooks";
import { TransactionForm } from "../../../features/transactions/TransactionForm";
import { todayIso } from "../../../lib/dates";

export default function NewTransactionScreen() {
  const createTransaction = useCreateTransaction();

  return (
    <FormScreen>
      <TransactionForm
        defaultValues={{ type: "expense", date: todayIso() }}
        submitLabel="Add transaction"
        onSubmit={async (values) => {
          await createTransaction.mutateAsync(values);
          router.back();
        }}
      />
    </FormScreen>
  );
}
