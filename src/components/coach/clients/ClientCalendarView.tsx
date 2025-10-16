
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarDialog } from '@/components/calendar/calendar-dialog';
import type { ClientProfile } from '@/types';
import { Calendar } from 'lucide-react';

interface ClientCalendarViewProps {
  client: ClientProfile;
}

export function ClientCalendarView({ client }: ClientCalendarViewProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsCalendarOpen(true)}
        variant="outline"
        className="w-full"
      >
        <Calendar className="mr-2 h-4 w-4" />
        View Calendar
      </Button>

      {isCalendarOpen && (
        <CalendarDialog
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          client={client}
        />
      )}
    </>
  );
}
