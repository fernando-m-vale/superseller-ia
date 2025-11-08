import * as React from "react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...props },
  ref
) {
  return <select ref={ref} className={className} {...props} />;
});

Select.displayName = "Select";

export { Select };
