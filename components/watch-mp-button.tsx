"use client";

import SubscribeButton from "@/components/subscribe-button";

type WatchMpButtonProps = {
  poselId: number;
  poselName: string;
  className?: string;
};

export default function WatchMpButton({
  poselId,
  poselName,
  className = "",
}: WatchMpButtonProps) {
  return (
    <SubscribeButton
      targetType="posel"
      targetId={poselId}
      name={poselName}
      variant="pill"
      className={className}
    />
  );
}
