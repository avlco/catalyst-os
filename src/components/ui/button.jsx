import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'bg-primary text-primary-foreground shadow hover:bg-accent-hover',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-muted hover:text-foreground',
  danger: 'bg-destructive text-destructive-foreground shadow hover:bg-destructive/90',
  outline: 'border border-border bg-transparent hover:bg-muted text-foreground',
};

const sizeClasses = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9',
};

const Button = forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export { Button };
