import Pitch from "@/components/Pitch";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center pt-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-200">TacticalRadar</h1>
      <Pitch />
    </main>
  );
}
