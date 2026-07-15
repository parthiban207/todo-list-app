const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// 1. Remove states
code = code.replace(/const \[user, setUser\] = useState<any>\(null\);\r?\n/, '');
code = code.replace(/const \[authMode, setAuthMode\] = useState<'login' \| 'signup'>\('login'\);\r?\n/, '');
code = code.replace(/const \[email, setEmail\] = useState\(''\);\r?\n/, '');
code = code.replace(/const \[password, setPassword\] = useState\(''\);\r?\n/, '');
code = code.replace(/const \[authLoading, setAuthLoading\] = useState\(false\);\r?\n/, '');

// 2. Remove user check in add/update task
code = code.replace(/if \(!user\) return;\r?\n\s*/g, '');

// 3. Replace user.id and user?.id with 'local-user'
code = code.replace(/user\.id/g, "'local-user'");
code = code.replace(/user\?\.id/g, "'local-user'");

// 4. Update the useEffect that uses supabase.auth
const useEffectOld = `  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setAppReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setTasks([]);
        setCategories(DEFAULT_CATEGORIES);
        setNotifications([]);
        setSearchHistory([]);
        setAppReady(true);
      }
    });`;
const useEffectNew = `  useEffect(() => {
    loadUserData('local-user');`;
code = code.replace(useEffectOld, useEffectNew);

// 5. Remove subscription.unsubscribe();
code = code.replace(/subscription\.unsubscribe\(\);\r?\n\s*/g, '');

// 6. Remove handleAuthSubmit and handleLogout
code = code.replace(/const handleAuthSubmit = async[\s\S]*?const toggleTheme/g, 'const toggleTheme');

// 7. Remove the !user return block (auth container)
code = code.replace(/if \(!user\) \{[\s\S]*?<\/div>\r?\n\s*<\/div>\r?\n\s*<ChatWindow[\s\S]*?\/>\r?\n\s*<\/>\r?\n\s*\};\r?\n/g, ''); // Adjusted regex to handle the return statement
code = code.replace(/if \(!user\) \{[\s\S]*?ChatWindow[\s\S]*?\/>\r?\n\s*<\/>\r?\n\s*\}/g, ''); 

// Also let's just make sure we capture it properly:
const authReturnStart = code.indexOf('if (!user) {');
if (authReturnStart !== -1) {
  const authReturnEnd = code.indexOf('  const filteredTaskList = getFilteredTasks();');
  if (authReturnEnd !== -1) {
    code = code.substring(0, authReturnStart) + code.substring(authReturnEnd);
  }
}

// 8. Replace user email display
code = code.replace(/\{user\.email\?\.charAt\(0\)\.toUpperCase\(\)\}/g, 'L');
code = code.replace(/\{user\.email\?\.split\('@'\)\[0\]\}/g, 'Local User');

fs.writeFileSync('src/app/page.tsx', code);
console.log('Done!');
