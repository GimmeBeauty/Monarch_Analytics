import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export default function ErrorState({
  message = "Unable to load data — check your data connections.",
  onRetry,
  isRetrying = false,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300/50 bg-red-50/60 dark:bg-red-100 dark:border-red-300/40 px-4 py-8 text-center ${className}`}
    >
      <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-700" />
      <p className="text-sm font-medium text-[#3A3A3A]/70 dark:text-[#003349]/60 max-w-md">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying} data-testid="button-retry">
          <RotateCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}
