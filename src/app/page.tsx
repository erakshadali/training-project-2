import { Benefits, CategoryTiles, CtaBand, Faq, Featured, Hero, HowItWorks, RentVsBuy } from "@/components/HomeSections";

export default function Home() {
  return (
    <>
      <Hero />
      <CategoryTiles />
      <HowItWorks />
      <Featured />
      <RentVsBuy />
      <Benefits />
      <Faq />
      <CtaBand />
    </>
  );
}
