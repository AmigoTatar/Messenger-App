// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 'md', color = 'emerald' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const colors = {
    emerald: 'border-emerald-500',
    white: 'border-white',
    gray: 'border-gray-500',
  };

  return (
    <div className="flex justify-center items-center p-4">
      <div
        className={`${sizes[size]} ${colors[color]} border-4 border-t-transparent rounded-full animate-spin`}
      />
    </div>
  );
}