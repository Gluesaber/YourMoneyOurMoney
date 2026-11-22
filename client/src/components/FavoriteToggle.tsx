import { useEffect, useState } from "react";
import { setTransactionFavorite, type Transaction } from "../api/finance.js";
import { ErrorAlert } from "./Feedback.js";

// F-10 §5 Star toggle button — docs/sprints/sprint-2/F-10-favorites-duplicate.md.
// Updates aria-pressed optimistically and rolls back with an alert on server error.
export function FavoriteToggle(props: {
  transactionId: number;
  isFavorite: boolean;
  onToggled?: (transaction: Transaction) => void;
  onError?: (error: unknown) => void;
}) {
  const [optimistic, setOptimistic] = useState(props.isFavorite);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<unknown>(null);

  useEffect(() => {
    setOptimistic(props.isFavorite);
  }, [props.isFavorite]);

  async function handleToggle() {
    const next = !optimistic;
    setOptimistic(next);
    setPending(true);
    setLocalError(null);
    props.onError?.(null);
    try {
      const updated = await setTransactionFavorite(props.transactionId, next);
      props.onToggled?.(updated);
    } catch (err) {
      setOptimistic(props.isFavorite);
      if (props.onError) props.onError(err);
      else setLocalError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm ${optimistic ? "btn-warning" : "btn-outline-secondary"}`}
        aria-pressed={optimistic}
        aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
        disabled={pending}
        onClick={() => void handleToggle()}
      >
        {optimistic ? "★" : "☆"}
      </button>
      {!props.onError && <ErrorAlert error={localError} />}
    </>
  );
}
