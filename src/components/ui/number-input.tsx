
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface AppNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | undefined | null;
  onChange: (value: number | '') => void;
  placeholder?: string;
}

const AppNumberInput = React.forwardRef<HTMLInputElement, AppNumberInputProps>(
  ({ value, onChange, placeholder, className, ...props }, ref) => {
    // The internal state and useEffect were the cause of the bug and have been removed.
    // The component is now fully controlled by its parent.

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const stringValue = e.target.value;
      if (stringValue === '') {
        onChange('');
      } else {
        const numValue = Number(stringValue);
        // Only call onChange if it's a valid number to prevent state issues in the parent.
        if (!isNaN(numValue)) {
          onChange(numValue);
        }
      }
    };
    
    // We convert null/undefined to an empty string for the input's value.
    const displayValue = value === null || value === undefined ? '' : String(value);

    return (
      <Input
        ref={ref}
        type="number"
        className={cn(className)}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

AppNumberInput.displayName = 'AppNumberInput';

export { AppNumberInput };
