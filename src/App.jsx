import { useState } from 'react';
import Home from './pages/Home.jsx';
import Import from './pages/Import.jsx';
import Crop from './pages/Crop.jsx';
import Answer from './pages/Answer.jsx';
import Confirm from './pages/Confirm.jsx';

export default function App() {
  const [page, setPage] = useState('home');
  const [session, setSession] = useState(null);
  // cropData is kept so going back from Crop → Import restores the file list
  const [cropData, setCropData] = useState(null);

  function navigate(nextPage, data) {
    if (nextPage === 'crop') {
      setCropData(data); // { name, rawPages }
    } else if (nextPage === 'answer' || nextPage === 'confirm') {
      setSession(data);
    }
    setPage(nextPage);
  }

  return (
    <div className="app">
      {page === 'home' && <Home onNavigate={navigate} />}

      {page === 'import' && (
        <Import
          onNavigate={navigate}
          initialPages={cropData?.rawPages ?? []}
          initialName={cropData?.name ?? ''}
        />
      )}

      {page === 'crop' && cropData && (
        <Crop
          name={cropData.name}
          rawPages={cropData.rawPages}
          onNavigate={navigate}
        />
      )}

      {page === 'answer' && session && (
        <Answer session={session} onNavigate={navigate} onUpdate={setSession} />
      )}

      {page === 'confirm' && session && (
        <Confirm session={session} onNavigate={navigate} />
      )}

    </div>
  );
}
