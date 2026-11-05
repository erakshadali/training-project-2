import type { Metadata } from "next";
import { RoomStudio } from "@/components/room/RoomStudio";

export const metadata: Metadata = {
  title: "Room Studio: try furniture in your hall",
  description: "Upload a photo of your empty room and place furniture in 3D at its real size. We check what fits and what suits your colours.",
};

export default function RoomStudioPage() {
  return <RoomStudio />;
}
