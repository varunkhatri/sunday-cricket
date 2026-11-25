import { notFound } from "next/navigation";
import DayView from "@/components/DayView";
import { getDayFull, getPlayerNames, getPlayerPhotos } from "@/lib/data/queries";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: { id: string } }) {
  const [data, names] = await Promise.all([getDayFull(params.id), getPlayerNames()]);
  const photos = await getPlayerPhotos();
  if (!data) notFound();
  return <DayView data={data} names={names} playerPhotos={photos} admin={isAdmin()} />;
}
