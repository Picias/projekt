import { getInitials } from "@/lib/posel";

type MpAvatarProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
  // Pozwala podmienić domyślną zieloną obwódkę na kolor klubu posła.
  frameClassName?: string;
};

const sizeClasses = {
  sm: "size-10 text-xs",
  md: "size-12 text-sm",
} as const;

export default function MpAvatar({
  name,
  photoUrl,
  size = "md",
  frameClassName = "ring-2 ring-sejm-green/30",
}: MpAvatarProps) {
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded-full bg-navy-800 ${frameClassName} ${sizeClass}`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="size-full object-cover object-top"
        />
      ) : (
        <span className="flex size-full items-center justify-center font-bold text-white">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
