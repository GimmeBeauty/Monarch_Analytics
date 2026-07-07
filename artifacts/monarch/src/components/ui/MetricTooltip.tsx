import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MetricTooltipProps {
  content: string;
}

export function MetricTooltip({ content }: MetricTooltipProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center cursor-help"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3 h-3 text-[#FFBC80]/55 hover:text-[#FFBC80]/90 transition-colors shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
