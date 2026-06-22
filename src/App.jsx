import { useState } from 'react';
import Home from './pages/Home.jsx';
import Import from './pages/Import.jsx';
import Answer from './pages/Answer.jsx';
import Confirm from './pages/Confirm.jsx';

export default function App() {
  const [page, setPage] = useState('home');
  const [session, setSession] = useState(null);

  function navigate(nextPage, nextSession) {
    if (nextSession !== undefined) setSession(nextSession);
    setPage(nextPage);
  }

  return (
    <div className="app">
      {page === 'home' && <Home onNavigate={navigate} />}
      {page === 'import' && <Import onNavigate={navigate} />}
      {page === 'answer' && (
        <Answer
          session={session}
          onNavigate={navigate}
          onUpdate={setSession}
        />
      )}
      {page === 'confirm' && (
        <Confirm session={session} onNavigate={navigate} />
      )}
    </div>
  );
}
