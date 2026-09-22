// Reusable star rating - read-only display (e.g. "4.3 (12 reviews)" next to
// a doctor's name) or interactive input (the review form). Kept as one
// component so both always render identically.
import { Star } from "lucide-react";

export default function StarRating({
  value = 0,
  onChange = null,
  size = 20,
  showValue = false,
  count = null,
}) {
  const interactive = typeof onChange === "function";
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={interactive ? "cursor-pointer" : "cursor-default"}
          >
            <Star
              size={size}
              className={n <= Math.round(value) ? "text-amber" : "text-stone"}
              fill={n <= Math.round(value) ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>
      {showValue && (
        <span className="text-xs text-slate ml-1">
          {value > 0 ? value.toFixed(1) : "No ratings yet"}
          {count !== null && count > 0 ? ` (${count})` : ""}
        </span>
      )}
    </div>
  );
}
