// frontend/src/components/SubjectIcon.jsx
// Affiche soit un emoji, soit une image (data URL) selon la valeur stockée

export default function SubjectIcon({ value, fallback, size = 16, className = '' }) {
  if (value?.startsWith('data:')) {
    return (
      <img
        src={value}
        alt=""
        style={{ width: size, height: size }}
        className={`rounded-sm object-cover shrink-0 ${className}`}
      />
    );
  }
  return (
    <span
      style={{ fontSize: size * 0.85, lineHeight: 1 }}
      className={`leading-none shrink-0 select-none ${className}`}
    >
      {value || fallback}
    </span>
  );
}
