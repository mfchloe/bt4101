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
  // Marking batch open in Essay marking; kept when switching pages so the
  // teacher comes back to the same batch
  const [markingBatch, setMarkingBatch] = useState(null);
  // Whether that batch was opened from the File library, so "back" returns there
  const [openedFromLibrary, setOpenedFromLibrary] = useState(false);
  // Library folder last shown, so returning to the library keeps the teacher's place
  const [libraryFolder, setLibraryFolder] = useState("Rubric");
  const Page = PAGES[active];

  const pageProps = {
    library: {
      folder: libraryFolder,
      onFolderChange: setLibraryFolder,
      onOpenBatch: (id) => {
        setMarkingBatch(id);
        setOpenedFromLibrary(true);
        setActive("marking");
      },
    },
    marking: {
      assignmentId: markingBatch,
      onBatchChange: (id) => {
        setMarkingBatch(id);
        setOpenedFromLibrary(false);
      },
      onBackToLibrary: openedFromLibrary
        ? () => {
            setMarkingBatch(null);
            setOpenedFromLibrary(false);
            setActive("library");
          }
        : null,
    },
  }[active];

  return (
    <div className="flex h-screen flex-col bg-mist">
      <NavBar active={active} onChange={setActive} />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Page {...pageProps} />
      </main>
    </div>
  );
}
