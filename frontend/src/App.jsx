import { useState } from "react";
import NavBar from "./components/NavBar";
import FileLibrary from "./pages/FileLibrary";
import ContentGenerator from "./pages/ContentGenerator";
import EssayMarking from "./pages/EssayMarking";
import Analytics from "./pages/Analytics";

const PAGES = {
  library: FileLibrary,
  generator: ContentGenerator,
  marking: EssayMarking,
  analytics: Analytics,
};

export default function App() {
  const [active, setActive] = useState("library");
  const Page = PAGES[active];

  return (
    <div className="flex h-screen flex-col bg-white">
      <NavBar active={active} onChange={setActive} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Page />
      </main>
    </div>
  );
}
