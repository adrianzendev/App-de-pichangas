import { GraduationCap } from "lucide-react";
import { useState, useEffect } from "react";
import type { Candidate, User } from "@shared/schema";
import { taskPrices } from "@/lib/price-sync";
import { formatPrice } from "@/lib/timezone-utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fmtTime12 } from "@/lib/date-format";

interface CandidateCardProps {
  candidate: Candidate & { tutor: User };
  taskId?: string;
  currency?: string | null;
}

export default function CandidateCard({ candidate, taskId, currency }: CandidateCardProps) {
  const createdAt = new Date(candidate.createdAt || Date.now());
  
  // DYNAMIC PRICING: Track updated prices for this candidate's task
  const [updatedPrice, setUpdatedPrice] = useState<string>("");
  
  // Listen for dynamic price updates if taskId is provided
  useEffect(() => {
    if (!taskId) return;

    const handlePriceUpdate = (event: CustomEvent) => {
      const { taskId: eventTaskId, newPrice, conversationKey } = event.detail;
      
      // Check if this update is for our task
      if (eventTaskId === taskId || 
          (conversationKey && conversationKey.includes(taskId))) {
        setUpdatedPrice(newPrice);
      }
    };

    const handleGlobalPriceUpdate = (event: CustomEvent) => {
      const { taskId: eventTaskId, conversationKey, newPrice, source } = event.detail;
      
      if (eventTaskId === taskId || 
          (conversationKey && conversationKey.includes(taskId))) {
        setUpdatedPrice(newPrice);
      }
    };

    // Listen to multiple event types for comprehensive coverage
    window.addEventListener('priceUpdate', handlePriceUpdate as EventListener);
    window.addEventListener('globalPriceUpdate', handleGlobalPriceUpdate as EventListener);
    window.addEventListener('taskPriceUpdate', handlePriceUpdate as EventListener);
    
    return () => {
      window.removeEventListener('priceUpdate', handlePriceUpdate as EventListener);
      window.removeEventListener('globalPriceUpdate', handleGlobalPriceUpdate as EventListener);
      window.removeEventListener('taskPriceUpdate', handlePriceUpdate as EventListener);
    };
  }, [taskId]);
  
  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar 
            name={candidate.tutor.name}
            avatar={candidate.tutor.avatar}
            size="md"
            userId={candidate.tutorId}
            showPresence={true}
          />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 truncate">{candidate.tutor.name}</h4>
            <div className="flex items-center space-x-2 text-label text-gray-600">
              <GraduationCap className="h-4 w-4 text-primary-600" />
              <span>Matemática {candidate.tutor.rating}</span>
            </div>
            <p className="text-label text-gray-700 mt-1 line-clamp-2">{candidate.message}</p>
            <span className="text-caption text-gray-700">
              {fmtTime12(createdAt)}
            </span>
          </div>
        </div>
        {candidate.proposedPrice && (
          <div className="text-right">
            <span className="inline-block whitespace-nowrap font-semibold text-gray-900 price-element">
              {formatPrice(String(candidate.proposedPrice || '0'), currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
