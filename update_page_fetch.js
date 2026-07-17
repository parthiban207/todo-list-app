const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

const apiFetchFunc = `
  const apiFetch = async (url: string, options: any = {}) => {
    let token = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {}
    
    const headers = {
      ...options.headers,
      ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})
    };
    
    return fetch(url, { ...options, headers });
  };
`;

if (!code.includes('const apiFetch = async')) {
  // insert apiFetch inside Home component
  code = code.replace(/export default function Home\(\) \{/, 'export default function Home() {\n' + apiFetchFunc);
  
  // replace all fetch('/api with apiFetch('/api
  code = code.replace(/fetch\('\/api/g, 'apiFetch(\'/api');
  code = code.replace(/fetch\(\`\/api/g, 'apiFetch(`\/api');
  
  fs.writeFileSync('src/app/page.tsx', code);
  console.log('Replaced successfully.');
} else {
  console.log('Already replaced.');
}
