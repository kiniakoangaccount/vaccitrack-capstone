export default function SkeletonBlock({ className }: { className: string }) {
  return <span aria-hidden="true" className={`loading-skeleton ${className}`} />;
}
