import { Benefits, CategoryTiles, CtaBand, Faq, Featured, Hero, HowItWorks, RentVsBuy, RoomStudioBanner } from "@/components/HomeSections";

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryTiles />
      <RoomStudioBanner />
      <HowItWorks />
      <Featured />
      <RentVsBuy />
      <Benefits />
      <Faq />
      <CtaBand />
    </>
  );
}
