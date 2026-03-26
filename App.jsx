<<<<<<< HEAD
import Login from "./components/Login";

function App() {
  return (
    <div>
      <Login />
    </div>
  );
}

export default App;
=======
import { db, auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import NotesModal from './NotesModal';
const [showNotes, setShowNotes] = useState(false);
const [portfolioNotes, setPortfolioNotes] = useState('');
const [isSavingNotes, setIsSavingNotes] = useState(false);
<button
  onClick={() => setShowNotes(true)}
  className="flex flex-col items-center gap-1 px-2 py-1 text-slate-600 hover:text-blue-600 transition-colors border border-slate-300 rounded bg-white"
  title="Take Notes"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
  <span className="text-xs font-light">Take Notes</span>
</button>
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setLoading(false);

    if (currentUser) {
      const lastUser = localStorage.getItem('last_user_id');
      if (lastUser && lastUser !== currentUser.uid) {
        console.log('🔄 User changed, clearing cache');

        const cacheKey = `portfolio_${currentUser.uid}`;
        const keys = [
          `${cacheKey}_holdings`,
          `${cacheKey}_transactions`,
          `${cacheKey}_aggregates`
        ];
        keys.forEach(key => localStorage.removeItem(key));
      }

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('price_cache_') || key === 'gold_price_global') {
          localStorage.removeItem(key);
        }
      });

      localStorage.setItem('last_user_id', currentUser.uid);
    }
  });

  return () => unsubscribe();
}, []);
if (!user) {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md mx-auto text-center">
          <Wallet className="mx-auto text-blue-600 mb-4" size={64} />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Portfolio Tracker
          </h1>
          <p className="text-slate-600 mb-6">
            Track your investments in one place
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <LogIn size={18} />
            Sign in with Google
          </button>
        </div>
      </div>
    </>
  );
}

const saveNotes = async () => {
  if (!user) return;

  setIsSavingNotes(true);
  try {
    const notesRef = doc(db, `users/${user.uid}/settings/notes`);
    await setDoc(notesRef, {
      content: portfolioNotes,
      updatedAt: new Date().toISOString()
    });
    alert('✅ Notes saved');
  } catch (error) {
    console.error('Error saving notes:', error);
    alert('Failed to save notes');
  }
  setIsSavingNotes(false);
};
useEffect(() => {
  if (!user) return;

  const loadNotes = async () => {
    try {
      const notesRef = doc(db, `users/${user.uid}/settings/notes`);
      const notesSnap = await getDoc(notesRef);
      if (notesSnap.exists()) {
        setPortfolioNotes(notesSnap.data().content || '');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  loadNotes();
}, [user]);
useEffect(() => {
  if (!user) return;

  const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000;
  const LAST_ACTIVITY_KEY = 'lastActivityTime';

  const updateActivity = () => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  };

  const checkInactivity = () => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);

    if (lastActivity) {
      const timeSinceActivity = Date.now() - Number(lastActivity);

      if (timeSinceActivity > INACTIVITY_LIMIT) {
        console.log('🔒 Auto-logout: 24hr inactivity');
        alert('You have been logged out due to inactivity (24 hours).');

        clearCache();
        localStorage.removeItem('lastDataFetch');
        localStorage.removeItem('hasUpdatedPrices');
        localStorage.removeItem(LAST_ACTIVITY_KEY);

        setLastDataFetch(null);
        setHasUpdatedPrices(false);

        logOut();
      }
    } else {
      updateActivity();
    }
  };

  checkInactivity();

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    window.addEventListener(event, updateActivity);
  });

  return () => {
    events.forEach(event => {
      window.removeEventListener(event, updateActivity);
    });
  };
}, [user]);

<NotesModal
  showNotes={showNotes}
  setShowNotes={setShowNotes}
  portfolioNotes={portfolioNotes}
  setPortfolioNotes={setPortfolioNotes}
  saveNotes={saveNotes}
  isSavingNotes={isSavingNotes}
/>

