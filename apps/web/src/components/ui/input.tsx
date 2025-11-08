import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={className} {...props} />;
});

Input.displayName = "Input";

export { Input };
